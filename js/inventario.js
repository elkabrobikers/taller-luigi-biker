
import { supabase } from "./supabase.js";

// ==========================================
// TALLER LUIGI BIKER - INVENTARIO COMPLETO
// ==========================================

const $ = id => document.getElementById(id);

const verificando = $("verificando");
const contenido = $("contenido");
const formulario = $("form-producto");
const nombre = $("nombre");
const categoria = $("categoria");
const precio = $("precio");
const stock = $("stock");
const descripcion = $("descripcion");
const fotoCamara = $("foto-camara");
const fotoArchivo = $("foto-archivo");
const vistaFoto = $("vista-foto");
const imagenPreview = $("imagen-preview");
const quitarFoto = $("quitar-foto");
const guardar = $("guardar");
const cancelar = $("cancelar");
const tituloFormulario = $("titulo-formulario");
const mensajeForm = $("mensaje-form");
const mensajeLista = $("mensaje-lista");
const lista = $("lista");
const buscar = $("buscar");
const actualizar = $("actualizar");
const filtroStock = $("filtro-stock");
const alertaInventario = $("alerta-inventario");
const textoAlerta = $("texto-alerta");
const verAlertas = $("ver-alertas");

const MAX_FOTO = 5 * 1024 * 1024;

const FORMATOS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

let autorizado = false;
let productos = [];
let productoEditando = null;
let fotoSeleccionada = null;
let urlPreview = null;
let ocupado = false;

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

function mostrarMensaje(
  elemento,
  texto,
  color = "#c4c4cc"
) {
  elemento.textContent = texto;
  elemento.style.color = color;
}

function obtenerError(error) {
  return (
    error?.message ||
    error?.details ||
    String(error || "Error desconocido.")
  );
}

function dinero(valor) {
  return "Bs. " + Number(valor || 0).toFixed(2);
}

function elemento(tipo, texto = "", clase = "") {
  const nodo = document.createElement(tipo);
  nodo.textContent = String(texto ?? "");

  if (clase) {
    nodo.className = clase;
  }

  return nodo;
}

function agregarDato(contenedor, titulo, valor) {
  const p = document.createElement("p");
  const strong = document.createElement("strong");

  strong.textContent = titulo + ": ";

  p.append(
    strong,
    document.createTextNode(String(valor ?? "—"))
  );

  contenedor.appendChild(p);
}

function estaActivo(producto) {
  return producto.activo !== false;
}

function unidades(producto) {
  return Number(producto.stock || 0);
}

function obtenerFoto(ruta) {
  if (!ruta) return null;

  if (/^https?:\/\//i.test(ruta)) {
    return ruta;
  }

  const { data } = supabase.storage
    .from("fotos-productos")
    .getPublicUrl(ruta);

  return data?.publicUrl || null;
}

// ==========================================
// VERIFICAR ACCESO DE ADMINISTRADOR
// ==========================================

async function verificarAcceso() {
  try {
    const { data, error } =
      await supabase.auth.getUser();

    if (error || !data?.user) {
      window.location.replace("./login.html");
      return;
    }

    const {
      data: perfil,
      error: errorPerfil
    } = await supabase
      .from("perfiles")
      .select("rol,activo")
      .eq("id", data.user.id)
      .single();

    if (errorPerfil) throw errorPerfil;

    if (
      !perfil ||
      perfil.rol !== "admin" ||
      perfil.activo !== true
    ) {
      verificando.textContent =
        "Acceso denegado. Solo administradores.";
      return;
    }

    autorizado = true;

    verificando.hidden = true;
    contenido.hidden = false;
    guardar.disabled = false;

    await cargarProductos();

  } catch (error) {
    console.error(error);

    verificando.textContent =
      "Error al verificar acceso: " +
      obtenerError(error);
  }
}

// ==========================================
// FOTOGRAFÍAS
// ==========================================

function limpiarFoto() {
  if (urlPreview) {
    URL.revokeObjectURL(urlPreview);
    urlPreview = null;
  }

  fotoSeleccionada = null;
  fotoCamara.value = "";
  fotoArchivo.value = "";

  imagenPreview.removeAttribute("src");
  vistaFoto.hidden = true;
}

function seleccionarFoto(archivo) {
  if (!archivo) return;

  if (!FORMATOS[archivo.type]) {
    mostrarMensaje(
      mensajeForm,
      "Solo se permiten JPG, PNG o WebP.",
      "#ff7a7a"
    );
    return;
  }

  if (archivo.size > MAX_FOTO) {
    mostrarMensaje(
      mensajeForm,
      "La fotografía no puede superar 5 MB.",
      "#ff7a7a"
    );
    return;
  }

  limpiarFoto();

  fotoSeleccionada = archivo;
  urlPreview = URL.createObjectURL(archivo);

  imagenPreview.src = urlPreview;
  vistaFoto.hidden = false;

  mostrarMensaje(
    mensajeForm,
    "Fotografía seleccionada.",
    "#69e4a2"
  );
}

fotoCamara.addEventListener("change", () => {
  seleccionarFoto(fotoCamara.files[0]);
});

fotoArchivo.addEventListener("change", () => {
  seleccionarFoto(fotoArchivo.files[0]);
});

quitarFoto.addEventListener("click", () => {
  limpiarFoto();

  mostrarMensaje(
    mensajeForm,
    "Selección de foto quitada."
  );
});

// ==========================================
// CARGAR PRODUCTOS
// ==========================================

async function cargarProductos() {
  if (!autorizado) return;

  actualizar.disabled = true;

  mostrarMensaje(
    mensajeLista,
    "Cargando productos..."
  );

  try {
    const { data, error } = await supabase
      .from("productos")
      .select(
        "id,nombre,descripcion,categoria," +
        "precio,stock,foto_url,activo,creado_en"
      )
      .order("creado_en", {
        ascending: false
      })
      .limit(200);

    if (error) throw error;

    productos = data || [];

    mostrarProductos();

  } catch (error) {
    console.error(error);

    mostrarMensaje(
      mensajeLista,
      "Error al cargar productos: " +
      obtenerError(error),
      "#ff7a7a"
    );

    lista.replaceChildren();

    $("total-productos").textContent = "—";
    $("stock-bajo").textContent = "—";
    $("sin-stock").textContent = "—";

    alertaInventario.hidden = true;

  } finally {
    actualizar.disabled = false;
  }
}

// ==========================================
// RESUMEN DEL INVENTARIO
// ==========================================

function actualizarResumen() {
  const activos = productos.filter(estaActivo);

  const bajos = activos.filter(producto =>
    unidades(producto) > 0 &&
    unidades(producto) <= 5
  );

  const agotados = activos.filter(producto =>
    unidades(producto) === 0
  );

  $("total-productos").textContent =
    productos.length;

  $("stock-bajo").textContent =
    bajos.length;

  $("sin-stock").textContent =
    agotados.length;

  alertaInventario.hidden =
    bajos.length === 0 &&
    agotados.length === 0;

  textoAlerta.textContent =
    `Hay ${bajos.length} productos con stock bajo y ` +
    `${agotados.length} productos agotados.`;
}

// ==========================================
// FILTRAR PRODUCTOS
// ==========================================

function filtrarProductos() {
  const texto = buscar.value.trim().toLowerCase();
  const filtro = filtroStock.value;

  return productos.filter(producto => {
    const contenidoBusqueda = [
      producto.nombre,
      producto.categoria,
      producto.descripcion
    ].join(" ").toLowerCase();

    if (!contenidoBusqueda.includes(texto)) {
      return false;
    }

    switch (filtro) {
      case "disponibles":
        return estaActivo(producto) &&
          unidades(producto) > 0;

      case "bajo":
        return estaActivo(producto) &&
          unidades(producto) > 0 &&
          unidades(producto) <= 5;

      case "agotados":
        return estaActivo(producto) &&
          unidades(producto) === 0;

      case "inactivos":
        return !estaActivo(producto);

      default:
        return true;
    }
  });
}

// ==========================================
// ELIMINAR PRODUCTO
// SOLO ACEPTAR O CANCELAR
// ==========================================

async function eliminarProducto(
  producto,
  boton
) {
  if (ocupado || !autorizado) return;

  const confirmado = window.confirm(
    `¿Estás seguro de eliminar definitivamente ` +
    `el producto "${producto.nombre}"?\n\n` +
    "Esta acción no se puede deshacer.\n\n" +
    "Aceptar = Eliminar\n" +
    "Cancelar = Conservar"
  );

  if (!confirmado) {
    mostrarMensaje(
      mensajeLista,
      "Eliminación cancelada."
    );
    return;
  }

  ocupado = true;

  boton.disabled = true;
  boton.textContent = "Eliminando...";

  mostrarMensaje(
    mensajeLista,
    `Eliminando "${producto.nombre}"...`
  );

  try {
    // Función segura de Supabase:
    // valida que sea administrador y que el
    // producto no tenga ventas registradas.

    const { error } = await supabase.rpc(
      "eliminar_producto_admin",
      {
        p_producto_id: String(producto.id)
      }
    );

    if (error) throw error;

    // Si se estaba editando este producto,
    // limpiar el formulario.
    if (
      productoEditando &&
      String(productoEditando.id) ===
      String(producto.id)
    ) {
      restablecerFormulario();
    }

    await cargarProductos();

    mostrarMensaje(
      mensajeLista,
      `Producto "${producto.nombre}" ` +
      "eliminado correctamente.",
      "#69e4a2"
    );

  } catch (error) {
    console.error(
      "Error al eliminar producto:",
      error
    );

    mostrarMensaje(
      mensajeLista,
      "No se pudo eliminar: " +
      obtenerError(error) +
      " Si tiene ventas registradas, " +
      "puedes desactivar el producto.",
      "#ff7a7a"
    );

  } finally {
    ocupado = false;

    if (boton.isConnected) {
      boton.disabled = false;
      boton.textContent = "🗑️ Eliminar";
    }
  }
}

// ==========================================
// MOSTRAR PRODUCTOS
// ==========================================

function mostrarProductos() {
  actualizarResumen();
  lista.replaceChildren();

  const filtrados = filtrarProductos();

  if (!filtrados.length) {
    mostrarMensaje(
      mensajeLista,
      productos.length
        ? "No se encontraron productos."
        : "Todavía no hay productos registrados."
    );
    return;
  }

  mostrarMensaje(
    mensajeLista,
    `Mostrando ${filtrados.length} de ` +
    `${productos.length} productos consultados.`
  );

  for (const producto of filtrados) {
    const tarjeta = elemento(
      "article",
      "",
      "producto-card"
    );

    const foto = obtenerFoto(producto.foto_url);

    if (foto) {
      const img = document.createElement("img");

      img.className = "producto-imagen";
      img.src = foto;
      img.alt = producto.nombre || "Producto";
      img.loading = "lazy";

      img.addEventListener("error", () => {
        img.replaceWith(
          elemento("div", "⚙️", "sin-imagen")
        );
      });

      tarjeta.appendChild(img);

    } else {
      tarjeta.appendChild(
        elemento("div", "⚙️", "sin-imagen")
      );
    }

    const info = elemento(
      "div",
      "",
      "producto-info"
    );

    info.appendChild(
      elemento("h3", producto.nombre)
    );

    agregarDato(
      info,
      "Categoría",
      producto.categoria
    );

    agregarDato(
      info,
      "Descripción",
      producto.descripcion || "Sin descripción"
    );

    agregarDato(
      info,
      "Precio",
      dinero(producto.precio)
    );

    const cantidad = unidades(producto);

    const textoStock = elemento(
      "p",
      `Stock: ${cantidad} unidades`
    );

    if (cantidad === 0) {
      textoStock.className = "sin-stock";
    } else if (cantidad <= 5) {
      textoStock.className = "stock-bajo";
    }

    info.appendChild(textoStock);

    let estadoTexto = "Disponible";
    let estadoClase = "stock-disponible";

    if (!estaActivo(producto)) {
      estadoTexto = "Inactivo";
      estadoClase = "stock-inactivo";

    } else if (cantidad === 0) {
      estadoTexto = "Agotado";
      estadoClase = "stock-agotado";

    } else if (cantidad <= 5) {
      estadoTexto = "⚠️ Stock bajo";
      estadoClase = "stock-advertencia";
    }

    info.appendChild(
      elemento(
        "span",
        estadoTexto,
        "etiqueta-stock " + estadoClase
      )
    );

    info.appendChild(
      elemento(
        "span",
        estaActivo(producto)
          ? "Activo"
          : "Inactivo",
        estaActivo(producto)
          ? "estado"
          : "estado inactivo"
      )
    );

    const acciones = elemento(
      "div",
      "",
      "acciones-producto"
    );

    // ======================================
    // EDITAR PRODUCTO
    // ======================================

    const btnEditar = elemento(
      "button",
      "✏️ Editar"
    );

    btnEditar.type = "button";

    btnEditar.addEventListener("click", () => {
      editarProducto(producto);
    });

    // ======================================
    // ACTIVAR / DESACTIVAR PRODUCTO
    // ======================================

    const btnEstado = elemento(
      "button",
      estaActivo(producto)
        ? "Desactivar"
        : "Activar",
      "btn-secundario"
    );

    btnEstado.type = "button";

    btnEstado.addEventListener(
      "click",
      async () => {
        if (ocupado) return;

        const nuevoEstado =
          !estaActivo(producto);

        const confirmado = window.confirm(
          `¿Deseas ${
            nuevoEstado ? "activar" : "desactivar"
          } el producto "${producto.nombre}"?`
        );

        if (!confirmado) return;

        ocupado = true;
        btnEstado.disabled = true;

        try {
          const { error } = await supabase
            .from("productos")
            .update({
              activo: nuevoEstado
            })
            .eq("id", producto.id)
            .select("id")
            .single();

          if (error) throw error;

          await cargarProductos();

        } catch (error) {
          console.error(error);

          mostrarMensaje(
            mensajeLista,
            "Error al actualizar: " +
            obtenerError(error),
            "#ff7a7a"
          );

        } finally {
          ocupado = false;
          btnEstado.disabled = false;
        }
      }
    );

    // ======================================
    // BOTÓN ELIMINAR
    // ======================================

    const btnEliminar = elemento(
      "button",
      "🗑️ Eliminar",
      "btn-eliminar"
    );

    btnEliminar.type = "button";

    btnEliminar.addEventListener(
      "click",
      () => eliminarProducto(
        producto,
        btnEliminar
      )
    );

    acciones.append(
      btnEditar,
      btnEstado,
      btnEliminar
    );

    info.appendChild(acciones);
    tarjeta.appendChild(info);
    lista.appendChild(tarjeta);
  }
}

// ==========================================
// EDITAR PRODUCTO
// ==========================================

function editarProducto(producto) {
  if (ocupado) return;

  productoEditando = producto;

  nombre.value = producto.nombre || "";
  categoria.value = producto.categoria || "";
  precio.value = producto.precio ?? 0;
  stock.value = producto.stock ?? 0;
  descripcion.value =
    producto.descripcion || "";

  limpiarFoto();

  tituloFormulario.textContent =
    "✏️ Editar producto #" + producto.id;

  guardar.textContent = "Guardar cambios";
  cancelar.hidden = false;

  mostrarMensaje(
    mensajeForm,
    "Editando " + producto.nombre +
    ". Si no eliges otra foto, " +
    "se conserva la actual."
  );

  $("panel-formulario").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

// ==========================================
// RESTABLECER FORMULARIO
// ==========================================

function restablecerFormulario() {
  formulario.reset();
  limpiarFoto();

  productoEditando = null;

  precio.value = "0";
  stock.value = "0";

  tituloFormulario.textContent =
    "➕ Registrar producto";

  guardar.textContent = "Guardar producto";
  cancelar.hidden = true;
}

cancelar.addEventListener("click", () => {
  if (ocupado) return;

  restablecerFormulario();

  mostrarMensaje(
    mensajeForm,
    "Edición cancelada."
  );
});

// ==========================================
// REGISTRAR O ACTUALIZAR PRODUCTO
// ==========================================

formulario.addEventListener(
  "submit",
  async evento => {
    evento.preventDefault();

    if (!autorizado || ocupado) return;

    const nombreValor = nombre.value.trim();
    const precioValor = Number(precio.value);
    const stockValor = Number(stock.value);

    if (!nombreValor || !categoria.value) {
      mostrarMensaje(
        mensajeForm,
        "Completa el nombre y la categoría.",
        "#ff7a7a"
      );
      return;
    }

    if (
      precio.value === "" ||
      stock.value === "" ||
      !Number.isFinite(precioValor) ||
      precioValor < 0 ||
      !Number.isSafeInteger(stockValor) ||
      stockValor < 0
    ) {
      mostrarMensaje(
        mensajeForm,
        "Revisa el precio y el stock.",
        "#ff7a7a"
      );
      return;
    }

    ocupado = true;
    guardar.disabled = true;
    cancelar.disabled = true;

    const editando = productoEditando;

    let fotoNueva = null;
    let guardado = false;

    try {
      let rutaFoto =
        editando?.foto_url || null;

      // ====================================
      // SUBIR FOTOGRAFÍA NUEVA
      // ====================================

      if (fotoSeleccionada) {
        mostrarMensaje(
          mensajeForm,
          "Subiendo fotografía..."
        );

        fotoNueva =
          "productos/" +
          crypto.randomUUID() +
          "." +
          FORMATOS[fotoSeleccionada.type];

        const { error: errorFoto } =
          await supabase.storage
            .from("fotos-productos")
            .upload(
              fotoNueva,
              fotoSeleccionada,
              {
                contentType:
                  fotoSeleccionada.type,
                upsert: false
              }
            );

        if (errorFoto) throw errorFoto;

        rutaFoto = fotoNueva;
      }

      const datos = {
        nombre: nombreValor,
        categoria: categoria.value,
        descripcion:
          descripcion.value.trim() || null,
        precio: precioValor,
        stock: stockValor,
        foto_url: rutaFoto
      };

      // ====================================
      // ACTUALIZAR PRODUCTO
      // ====================================

      if (editando) {
        const { error } = await supabase
          .from("productos")
          .update(datos)
          .eq("id", editando.id)
          .select("id")
          .single();

        if (error) throw error;

      } else {
        // ==================================
        // REGISTRAR PRODUCTO NUEVO
        // ==================================

        datos.activo = true;

        const { error } = await supabase
          .from("productos")
          .insert(datos)
          .select("id")
          .single();

        if (error) throw error;
      }

      guardado = true;

      restablecerFormulario();

      mostrarMensaje(
        mensajeForm,
        editando
          ? "¡Producto actualizado correctamente!"
          : "¡Producto registrado correctamente!",
        "#69e4a2"
      );

      await cargarProductos();

    } catch (error) {
      console.error(
        "Error al guardar producto:",
        error
      );

      // Si falló el guardado y se subió una
      // foto nueva, intentar quitar esa foto.
      if (fotoNueva && !guardado) {
        const { error: errorLimpieza } =
          await supabase.storage
            .from("fotos-productos")
            .remove([fotoNueva]);

        if (errorLimpieza) {
          console.error(
            "Error al limpiar foto:",
            errorLimpieza
          );
        }
      }

      mostrarMensaje(
        mensajeForm,
        "Error al guardar: " +
        obtenerError(error),
        "#ff7a7a"
      );

    } finally {
      ocupado = false;
      guardar.disabled = false;
      cancelar.disabled = false;

      guardar.textContent = productoEditando
        ? "Guardar cambios"
        : "Guardar producto";
    }
  }
);

// ==========================================
// BUSCAR Y ACTUALIZAR
// ==========================================

buscar.addEventListener(
  "input",
  mostrarProductos
);

filtroStock.addEventListener(
  "change",
  mostrarProductos
);

actualizar.addEventListener(
  "click",
  cargarProductos
);

// ==========================================
// VER ALERTAS DE INVENTARIO
// ==========================================

verAlertas.addEventListener("click", () => {
  buscar.value = "";
  filtroStock.value = "todos";

  mostrarProductos();

  const tarjetas = [...lista.children];

  tarjetas.sort((a, b) => {
    function prioridad(tarjeta) {
      if (
        tarjeta.querySelector(".stock-agotado")
      ) {
        return 0;
      }

      if (
        tarjeta.querySelector(".stock-advertencia")
      ) {
        return 1;
      }

      return 2;
    }

    return prioridad(a) - prioridad(b);
  });

  lista.replaceChildren(...tarjetas);

  $("panel-listado").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
});

// ==========================================
// INICIAR INVENTARIO
// ==========================================

verificarAcceso();
