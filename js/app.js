
import { supabase } from "./supabase.js";

// ==========================================
// TALLER LUIGI BIKER - PÁGINA PÚBLICA
// ==========================================

const $ = (id) => document.getElementById(id);

let placaConsultada = "";
let datosAnteriores = "";
let buscando = false;
let productos = [];
let ultimaBusqueda = 0;
let catalogoCargado = false;

// ==========================================
// FUNCIONES GENERALES
// ==========================================

function crear(etiqueta, texto = "", clase = "") {
  const elemento = document.createElement(etiqueta);
  elemento.textContent = String(texto ?? "");

  if (clase) {
    elemento.className = clase;
  }

  return elemento;
}

function mensaje(id, texto) {
  const elemento = $(id);

  if (elemento) {
    elemento.textContent = texto;
  }
}

function fecha(valor) {
  if (!valor) return "Sin fecha registrada";

  const d = new Date(valor);

  return Number.isNaN(d.getTime())
    ? "Sin fecha registrada"
    : d.toLocaleString("es-BO");
}

function estadoTexto(estado) {
  const estados = {
    recibida: "Moto recibida",
    en_reparacion: "En reparación",
    finalizada: "Lista para entrega"
  };

  return estados[estado] || estado || "Sin reparación";
}

function limpiarPlaca(valor) {
  return String(valor || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
}

function descripcionError(error) {
  if (!error) return "Error desconocido.";

  const partes = [
    error.message,
    error.details,
    error.hint
  ].filter(Boolean);

  return partes.join(" | ") || String(error);
}

function agregarDato(destino, titulo, valor) {
  if (!destino) return;

  const fila = crear("div", "", "dato-publico");

  fila.append(
    crear("span", titulo),
    crear("strong", valor ?? "No registrado")
  );

  destino.appendChild(fila);
}

function agregarEvento(
  destino,
  titulo,
  descripcion,
  fechaEvento,
  pendiente = false
) {
  if (!destino) return;

  const evento = crear(
    "div",
    "",
    pendiente ? "evento-publico pendiente" : "evento-publico"
  );

  const punto = crear(
    "div",
    pendiente ? "" : "✓",
    "evento-punto"
  );

  const contenido = crear("div", "", "evento-contenido");

  contenido.append(
    crear("h4", titulo),
    crear("p", descripcion || "Sin descripción"),
    crear("small", fechaEvento || "Sin fecha")
  );

  evento.append(punto, contenido);
  destino.appendChild(evento);
}

// ==========================================
// MENÚ DE CELULARES
// ==========================================

function iniciarMenu() {
  const botonMenu = $("menu-toggle");
  const enlacesMenu = $("nav-links");

  if (!botonMenu || !enlacesMenu) return;

  botonMenu.addEventListener("click", () => {
    const abierto = enlacesMenu.classList.toggle("activo");

    botonMenu.setAttribute(
      "aria-expanded",
      String(abierto)
    );

    botonMenu.textContent = abierto ? "✕" : "☰";
  });

  document.querySelectorAll(".nav-links a").forEach((enlace) => {
    enlace.addEventListener("click", () => {
      enlacesMenu.classList.remove("activo");
      botonMenu.setAttribute("aria-expanded", "false");
      botonMenu.textContent = "☰";
    });
  });
}

// ==========================================
// FOTOGRAFÍAS DE SUPABASE
// ==========================================

function obtenerUrlFoto(rutaGuardada, bucket) {
  const ruta = String(rutaGuardada || "").trim();

  if (!ruta) return null;

  // Permitir enlaces HTTPS completos.
  if (/^https:\/\//i.test(ruta)) {
    return ruta;
  }

  // Rechazar enlaces HTTP u otros esquemas.
  if (/^[a-z][a-z0-9+.-]*:/i.test(ruta)) {
    return null;
  }

  // Evitar duplicar el nombre del bucket.
  const prefijo = `${bucket}/`;

  const rutaLimpia = ruta.startsWith(prefijo)
    ? ruta.slice(prefijo.length)
    : ruta;

  if (!rutaLimpia) return null;

  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(rutaLimpia);

  return data?.publicUrl || null;
}

// ==========================================
// CATÁLOGO PÚBLICO
// ==========================================

function normalizarProductos(data) {
  // Formato habitual de una función que devuelve una lista.
  if (Array.isArray(data)) {
    return data;
  }

  // Algunas funciones devuelven un objeto con una lista.
  if (data && typeof data === "object") {
    if (Array.isArray(data.productos)) {
      return data.productos;
    }

    if (Array.isArray(data.data)) {
      return data.data;
    }

    if (Array.isArray(data.items)) {
      return data.items;
    }
  }

  return [];
}

async function cargarCatalogo() {
  const destino = $("lista-productos-publicos");

  if (!destino) {
    console.error(
      "No existe el elemento lista-productos-publicos en index.html."
    );
    return;
  }

  catalogoCargado = false;

  mensaje(
    "mensaje-catalogo",
    "⏳ Cargando productos disponibles..."
  );

  destino.replaceChildren();

  try {
    const { data, error } = await supabase.rpc(
      "consultar_catalogo_publico"
    );

    if (error) throw error;

    console.log("Respuesta del catálogo:", data);

    productos = normalizarProductos(data);

    // Permite reconocer un formato inesperado.
    if (
      data !== null &&
      !Array.isArray(data) &&
      !Array.isArray(data?.productos) &&
      !Array.isArray(data?.data) &&
      !Array.isArray(data?.items)
    ) {
      console.warn(
        "La función consultar_catalogo_publico devolvió un formato diferente:",
        data
      );

      mensaje(
        "mensaje-catalogo",
        "La consulta respondió, pero el formato del catálogo no es una lista de productos."
      );
    } else {
      mensaje("mensaje-catalogo", "");
    }

    const selector = $("categoria-publica");

    if (selector) {
      const seleccionAnterior = selector.value;

      selector.replaceChildren(
        new Option("Todas las categorías", "")
      );

      const categorias = [
        ...new Set(
          productos
            .map((producto) => producto.categoria)
            .filter(Boolean)
        )
      ].sort();

      for (const categoria of categorias) {
        selector.add(
          new Option(categoria, categoria)
        );
      }

      if (
        Array.from(selector.options).some(
          (opcion) => opcion.value === seleccionAnterior
        )
      ) {
        selector.value = seleccionAnterior;
      }
    }

    catalogoCargado = true;
    dibujarCatalogo();

    console.log(
      "Productos encontrados:",
      productos.length
    );

  } catch (error) {
    console.error("Error al cargar productos:", error);

    mensaje(
      "mensaje-catalogo",
      "❌ No se pudo cargar el catálogo: " +
      descripcionError(error)
    );

    destino.replaceChildren(
      crear(
        "p",
        "No fue posible consultar los productos de Supabase."
      )
    );
  }
}

// ==========================================
// DIBUJAR PRODUCTOS
// ==========================================

function dibujarCatalogo() {
  const destino = $("lista-productos-publicos");

  if (!destino) return;

  destino.replaceChildren();

  if (!catalogoCargado) return;

  const busqueda = String(
    $("buscar-producto-publico")?.value || ""
  ).trim().toLowerCase();

  const categoria = String(
    $("categoria-publica")?.value || ""
  ).trim().toLowerCase();

  const filtrados = productos.filter((producto) => {
    const texto = [
      producto.nombre,
      producto.descripcion,
      producto.categoria
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const coincideBusqueda = texto.includes(busqueda);

    const coincideCategoria =
      !categoria ||
      String(producto.categoria || "")
        .toLowerCase() === categoria;

    return coincideBusqueda && coincideCategoria;
  });

  if (!filtrados.length) {
    const texto = productos.length === 0
      ? "Todavía no hay productos publicados en el catálogo."
      : "No encontramos productos con esos filtros.";

    destino.appendChild(crear("p", texto));
    return;
  }

  for (const producto of filtrados) {
    const tarjeta = crear(
      "article",
      "",
      "producto-publico"
    );

    // Fotografía
    const foto = crear(
      "div",
      "📦 Imagen no disponible",
      "producto-publico-imagen"
    );

    const urlFoto = obtenerUrlFoto(
      producto.foto_url,
      "fotos-productos"
    );

    if (urlFoto) {
      const imagen = document.createElement("img");

      imagen.src = urlFoto;
      imagen.alt = producto.nombre || "Producto";
      imagen.loading = "lazy";

      imagen.onerror = () => {
        foto.textContent = "📦 Imagen no disponible";
      };

      foto.replaceChildren(imagen);
    }

    // Información
    const info = crear(
      "div",
      "",
      "producto-publico-info"
    );

    const nombre = crear(
      "h3",
      producto.nombre || "Producto sin nombre"
    );

    const descripcion = crear(
      "p",
      producto.descripcion || "Producto disponible."
    );

    const categoriaTexto = crear(
      "p",
      `Categoría: ${producto.categoria || "General"}`
    );

    const precioNumero = Number(producto.precio);

    const precio = crear(
      "div",
      `Bs. ${
        Number.isFinite(precioNumero)
          ? precioNumero.toFixed(2)
          : "0.00"
      }`,
      "producto-publico-precio"
    );

    const stockNumero = Number(producto.stock ?? 0);

    const stock = crear(
      "div",
      stockNumero > 0
        ? `✓ Disponibles: ${stockNumero}`
        : "Sin existencias",
      "producto-publico-stock"
    );

    if (stockNumero <= 0) {
      stock.style.background = "#49302a";
      stock.style.color = "#ffb5a1";
      stock.style.borderColor = "#835043";
    }

    info.append(
      nombre,
      descripcion,
      categoriaTexto,
      precio,
      stock
    );

    tarjeta.append(foto, info);
    destino.appendChild(tarjeta);
  }
}

// ==========================================
// FILTROS Y BOTONES
// ==========================================

function iniciarFiltros() {
  $("buscar-producto-publico")?.addEventListener(
    "input",
    dibujarCatalogo
  );

  $("categoria-publica")?.addEventListener(
    "change",
    dibujarCatalogo
  );

  document.querySelectorAll("[data-categoria]").forEach(
    (enlace) => {
      enlace.addEventListener("click", () => {
        const categoriaBuscada = String(
          enlace.dataset.categoria || ""
        ).toLowerCase();

        const selector = $("categoria-publica");

        if (!selector) return;

        const opcion = Array.from(selector.options).find(
          (opcionActual) =>
            opcionActual.value
              .toLowerCase()
              .includes(categoriaBuscada)
        );

        selector.value = opcion ? opcion.value : "";
        dibujarCatalogo();
      });
    }
  );
}

// ==========================================
// BUSCAR MOTOCICLETA POR PLACA
// ==========================================

function iniciarBusquedaMoto() {
  const formulario = $("form-buscar-moto");

  if (!formulario) {
    console.error(
      "No existe form-buscar-moto en index.html."
    );
    return;
  }

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const campoPlaca = $("placa");

    if (!campoPlaca) return;

    const placa = limpiarPlaca(campoPlaca.value);
    campoPlaca.value = placa;

    if (placa.length < 4) {
      mensaje(
        "resultado-busqueda",
        "Ingresa una placa válida."
      );
      return;
    }

    placaConsultada = placa;
    datosAnteriores = "";

    const resultado = $("seguimiento-resultado");

    if (resultado) {
      resultado.hidden = true;
    }

    await consultarMoto();
  });
}

async function consultarMoto(silencioso = false) {
  if (!placaConsultada || buscando) return;

  buscando = true;

  const placaSolicitada = placaConsultada;
  const numeroBusqueda = ++ultimaBusqueda;
  const boton = $("btn-buscar-moto");

  if (boton) boton.disabled = true;

  if (!silencioso) {
    mensaje(
      "resultado-busqueda",
      "⏳ Buscando motocicleta..."
    );
  }

  try {
    const { data, error } = await supabase.rpc(
      "consultar_seguimiento_publico",
      { p_placa: placaSolicitada }
    );

    if (error) throw error;

    console.log("Respuesta del seguimiento:", data);

    if (
      numeroBusqueda !== ultimaBusqueda ||
      placaSolicitada !== placaConsultada
    ) {
      return;
    }

    if (!data || !data.encontrada) {
      const resultado = $("seguimiento-resultado");

      if (resultado) {
        resultado.hidden = true;
      }

      mensaje(
        "resultado-busqueda",
        "No encontramos esa motocicleta. Verifica la placa."
      );

      return;
    }

    const contenido = JSON.stringify(data);

    if (contenido !== datosAnteriores) {
      const resultado = $("seguimiento-resultado");

      const habiaResultado = resultado
        ? !resultado.hidden
        : false;

      datosAnteriores = contenido;
      dibujarSeguimiento(data);

      if (silencioso && habiaResultado) {
        mensaje(
          "resultado-busqueda",
          "🔔 El seguimiento de tu moto se ha actualizado."
        );
      } else {
        mensaje("resultado-busqueda", "");
      }
    }

  } catch (error) {
    console.error("Error de seguimiento:", error);

    if (!silencioso) {
      mensaje(
        "resultado-busqueda",
        "❌ No se pudo consultar la motocicleta: " +
        descripcionError(error)
      );
    }

  } finally {
    buscando = false;

    if (boton) {
      boton.disabled = false;
    }
  }
}

// ==========================================
// MOSTRAR SEGUIMIENTO
// ==========================================

function dibujarSeguimiento(data) {
  const moto = data.moto || {};
  const trabajo = data.reparacion || null;

  const avances = Array.isArray(data.avances)
    ? data.avances
    : [];

  const repuestos = Array.isArray(data.repuestos)
    ? data.repuestos
    : [];

  const estado = trabajo?.estado || "sin_reparacion";

  mensaje(
    "moto-titulo",
    `${moto.marca || "Motocicleta"} ${moto.modelo || ""}`
  );

  mensaje(
    "moto-subtitulo",
    `Placa ${moto.placa || ""}`
  );

  const etiquetaEstado = $("moto-estado");

  if (etiquetaEstado) {
    etiquetaEstado.textContent = estadoTexto(estado);

    etiquetaEstado.className =
      "estado-publico" +
      (estado === "finalizada" ? " finalizada" : "");
  }

  mensaje(
    "moto-estado-texto",
    "● " + estadoTexto(estado)
  );

  const titulos = {
    recibida: "HEMOS RECIBIDO TU MOTO",
    en_reparacion: "ESTAMOS TRABAJANDO EN TU MOTO",
    finalizada: "¡TU MOTO ESTÁ LISTA!"
  };

  const descripciones = {
    recibida:
      "Tu motocicleta fue registrada en el taller.",
    en_reparacion:
      "El mecánico está realizando los trabajos de reparación.",
    finalizada:
      "El trabajo terminó. Consulta al taller para la entrega."
  };

  mensaje(
    "moto-mensaje-estado",
    titulos[estado] || "SEGUIMIENTO DE TU MOTO"
  );

  mensaje(
    "moto-descripcion-estado",
    descripciones[estado] ||
      "Todavía no hay una reparación registrada."
  );

  dibujarFoto(moto);
  dibujarDatos(moto, trabajo);
  dibujarHistorial(trabajo, avances);
  dibujarRepuestos(repuestos);

  const aviso = $("aviso-moto-lista");

  if (aviso) {
    aviso.hidden = estado !== "finalizada";
  }

  const resultado = $("seguimiento-resultado");

  if (resultado) {
    resultado.hidden = false;
  }
}

// ==========================================
// FOTO DE LA MOTO
// ==========================================

function dibujarFoto(moto) {
  const contenedor = $("moto-foto");

  if (!contenedor) return;

  contenedor.replaceChildren();

  const url = obtenerUrlFoto(
    moto.foto_url,
    "fotos-motos"
  );

  if (!url) {
    contenedor.appendChild(
      crear("div", "🏍️ Fotografía no disponible")
    );
    return;
  }

  const imagen = document.createElement("img");

  imagen.src = url;
  imagen.alt = `Motocicleta ${moto.placa || ""}`;
  imagen.loading = "lazy";

  imagen.onerror = () => {
    contenedor.replaceChildren(
      crear("div", "🏍️ No se pudo cargar la fotografía")
    );
  };

  contenedor.appendChild(imagen);
}

// ==========================================
// DATOS DE LA MOTO
// ==========================================

function dibujarDatos(moto, trabajo) {
  const destino = $("moto-datos");

  if (!destino) return;

  destino.replaceChildren();

  agregarDato(destino, "Placa", moto.placa);
  agregarDato(destino, "Marca", moto.marca);
  agregarDato(destino, "Modelo", moto.modelo);
  agregarDato(destino, "Color", moto.color);

  if (trabajo?.fecha_ingreso) {
    agregarDato(
      destino,
      "Fecha de ingreso",
      fecha(trabajo.fecha_ingreso)
    );
  }

  if (
    trabajo?.estado === "finalizada" &&
    trabajo.fecha_entrega
  ) {
    agregarDato(
      destino,
      "Finalización",
      fecha(trabajo.fecha_entrega)
    );
  }
}

// ==========================================
// HISTORIAL DE REPARACIÓN
// ==========================================

function dibujarHistorial(trabajo, avances) {
  const destino = $("moto-historial");

  if (!destino) return;

  destino.replaceChildren();

  if (!trabajo) {
    agregarEvento(
      destino,
      "Sin reparación registrada",
      "Todavía no existe una orden de trabajo.",
      "PENDIENTE",
      true
    );
    return;
  }

  agregarEvento(
    destino,
    "Moto recibida",
    "Tu motocicleta ingresó al taller.",
    fecha(trabajo.fecha_ingreso)
  );

  for (const avance of avances) {
    agregarEvento(
      destino,
      "Avance del mecánico",
      avance.descripcion,
      fecha(avance.creado_en)
    );
  }

  const enProceso =
    trabajo.estado === "en_reparacion" ||
    trabajo.estado === "finalizada";

  agregarEvento(
    destino,
    "Reparación en proceso",
    enProceso
      ? "El taller está trabajando en tu motocicleta."
      : "Esperando el inicio de los trabajos.",
    enProceso ? "ETAPA ALCANZADA" : "PENDIENTE",
    !enProceso
  );

  const finalizada = trabajo.estado === "finalizada";

  agregarEvento(
    destino,
    "Lista para despacho",
    finalizada
      ? "Reparación finalizada. Consulta al taller para la entrega."
      : "Pendiente de finalización.",
    finalizada
      ? fecha(trabajo.fecha_entrega)
      : "PENDIENTE",
    !finalizada
  );
}

// ==========================================
// REPUESTOS UTILIZADOS
// ==========================================

function dibujarRepuestos(repuestos) {
  const destino = $("moto-repuestos");

  if (!destino) return;

  destino.replaceChildren();

  if (!repuestos.length) {
    destino.appendChild(
      crear(
        "p",
        "Todavía no hay repuestos registrados."
      )
    );
    return;
  }

  for (const repuesto of repuestos) {
    const fila = crear(
      "div",
      "",
      "repuesto-publico"
    );

    const informacion = crear("div");

    informacion.append(
      crear("strong", repuesto.nombre || "Repuesto"),
      crear(
        "small",
        `Cantidad: ${repuesto.cantidad ?? 1}`
      )
    );

    fila.appendChild(informacion);
    destino.appendChild(fila);
  }
}

// ==========================================
// ACTUALIZACIONES AUTOMÁTICAS
// ==========================================

function iniciarActualizaciones() {
  setInterval(() => {
    if (document.hidden) return;

    if (placaConsultada) {
      consultarMoto(true);
    }
  }, 15000);

  document.addEventListener(
    "visibilitychange",
    () => {
      if (!document.hidden && placaConsultada) {
        consultarMoto(true);
      }
    }
  );
}

// ==========================================
// INICIAR LA PÁGINA
// ==========================================

function iniciarPagina() {
  console.log("🏍️ Iniciando Taller Luigi Biker");

  iniciarMenu();
  iniciarFiltros();
  iniciarBusquedaMoto();
  iniciarActualizaciones();
  cargarCatalogo();
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    iniciarPagina
  );
} else {
  iniciarPagina();
}
