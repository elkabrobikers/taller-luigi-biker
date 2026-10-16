
import { supabase } from "./supabase.js";

// ==========================================
// TALLER LUIGI BIKER
// PÁGINA PÚBLICA
// ==========================================

const $ = id => document.getElementById(id);

let placaConsultada = "";
let datosAnteriores = "";
let buscando = false;
let productos = [];
let ultimaBusqueda = 0;

function crear(etiqueta, texto = "", clase = "") {
  const elemento = document.createElement(etiqueta);
  elemento.textContent = String(texto ?? "");
  if (clase) elemento.className = clase;
  return elemento;
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

function agregarDato(destino, titulo, valor) {
  const fila = crear("div", "", "dato-publico");
  fila.append(
    crear("span", titulo),
    crear("strong", valor || "No registrado")
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
    crear("p", descripcion),
    crear("small", fechaEvento)
  );

  evento.append(punto, contenido);
  destino.appendChild(evento);
}

// ==========================================
// MENÚ PARA CELULARES
// ==========================================

const botonMenu = $("menu-toggle");
const enlacesMenu = $("nav-links");

if (botonMenu && enlacesMenu) {
  botonMenu.addEventListener("click", () => {
    const abierto = enlacesMenu.classList.toggle("activo");

    botonMenu.setAttribute(
      "aria-expanded",
      String(abierto)
    );

    botonMenu.textContent = abierto ? "✕" : "☰";
  });

  document.querySelectorAll(".nav-links a").forEach(enlace => {
    enlace.addEventListener("click", () => {
      enlacesMenu.classList.remove("activo");
      botonMenu.setAttribute("aria-expanded", "false");
      botonMenu.textContent = "☰";
    });
  });
}

// ==========================================
// BUSCAR MOTO SIN INICIAR SESIÓN
// ==========================================

$("form-buscar-moto").addEventListener(
  "submit",
  async evento => {
    evento.preventDefault();

    const placa = limpiarPlaca($("placa").value);
    $("placa").value = placa;

    if (placa.length < 4) {
      $("resultado-busqueda").textContent =
        "Ingresa una placa válida.";
      return;
    }

    placaConsultada = placa;
    datosAnteriores = "";
    $("seguimiento-resultado").hidden = true;

    await consultarMoto();
  }
);

async function consultarMoto(silencioso = false) {
  if (!placaConsultada || buscando) return;

  buscando = true;
  const placaSolicitada = placaConsultada;
  const numeroBusqueda = ++ultimaBusqueda;

  const boton = $("btn-buscar-moto");
  boton.disabled = true;

  if (!silencioso) {
    $("resultado-busqueda").textContent =
      "Buscando motocicleta...";
  }

  try {
    const { data, error } = await supabase.rpc(
      "consultar_seguimiento_publico",
      { p_placa: placaSolicitada }
    );

    if (error) throw error;

    if (numeroBusqueda !== ultimaBusqueda ||
        placaSolicitada !== placaConsultada) {
      return;
    }

    if (!data?.encontrada) {
      $("seguimiento-resultado").hidden = true;
      $("resultado-busqueda").textContent =
        "No encontramos esa motocicleta. " +
        "Verifica la placa o consulta al taller.";
      return;
    }

    const contenido = JSON.stringify(data);

    if (contenido !== datosAnteriores) {
      const habiaResultado =
        !$("seguimiento-resultado").hidden;

      datosAnteriores = contenido;
      dibujarSeguimiento(data);

      if (silencioso && habiaResultado) {
        $("resultado-busqueda").textContent =
          "🔔 El seguimiento de tu moto se ha actualizado.";
      } else {
        $("resultado-busqueda").textContent = "";
      }
    }

  } catch (error) {
    console.error("Error de seguimiento:", error);

    if (!silencioso) {
      $("resultado-busqueda").textContent =
        "No se pudo consultar el seguimiento: " +
        error.message;
    }
  } finally {
    buscando = false;
    boton.disabled = false;
  }
}

// ==========================================
// MOSTRAR DATOS DE LA MOTOCICLETA
// ==========================================

function dibujarSeguimiento(data) {
  const moto = data.moto || {};
  const trabajo = data.reparacion;
  const avances = Array.isArray(data.avances)
    ? data.avances
    : [];
  const repuestos = Array.isArray(data.repuestos)
    ? data.repuestos
    : [];

  const estado = trabajo?.estado || "sin_reparacion";

  $("moto-titulo").textContent =
    `${moto.marca || "Motocicleta"} ${moto.modelo || ""}`;

  $("moto-subtitulo").textContent =
    `Placa ${moto.placa || ""}`;

  $("moto-estado").textContent = estadoTexto(estado);
  $("moto-estado").className =
    "estado-publico" +
    (estado === "finalizada" ? " finalizada" : "");

  $("moto-estado-texto").textContent =
    "● " + estadoTexto(estado);

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

  $("moto-mensaje-estado").textContent =
    titulos[estado] || "SEGUIMIENTO DE TU MOTO";

  $("moto-descripcion-estado").textContent =
    descripciones[estado] ||
    "Todavía no hay una reparación registrada.";

  dibujarFoto(moto);
  dibujarDatos(moto, trabajo);
  dibujarHistorial(trabajo, avances);
  dibujarRepuestos(repuestos);

  $("aviso-moto-lista").hidden =
    estado !== "finalizada";

  $("seguimiento-resultado").hidden = false;
}

// ==========================================
// FOTOGRAFÍAS PÚBLICAS DE SUPABASE
// ==========================================

// Convierte la ruta de una fotografía en una URL pública.
// Los buckets fotos-motos y fotos-productos
// deben estar configurados como públicos.
function obtenerUrlFoto(rutaGuardada, bucket) {
  const ruta = String(rutaGuardada || "").trim();

  if (!ruta) return null;

  // Si ya es un enlace HTTPS completo.
  if (/^https:\/\//i.test(ruta)) {
    return ruta;
  }

  // Rechazar otros esquemas de URL.
  if (/^[a-z][a-z0-9+.-]*:/i.test(ruta)) {
    return null;
  }

  // Evitar duplicar el nombre del bucket.
  const prefijo = `${bucket}/`;

  const rutaLimpia = ruta.startsWith(prefijo)
    ? ruta.slice(prefijo.length)
    : ruta;

  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(rutaLimpia);

  return data?.publicUrl || null;
}

// ==========================================
// MOSTRAR FOTO DE LA MOTOCICLETA
// ==========================================

function dibujarFoto(moto) {
  const contenedor = $("moto-foto");
  contenedor.replaceChildren();

  const url = obtenerUrlFoto(
    moto.foto_url,
    "fotos-motos"
  );

  if (!url) {
    contenedor.appendChild(
      crear(
        "div",
        "🏍️ Fotografía no disponible"
      )
    );
    return;
  }

  const imagen = document.createElement("img");

  imagen.src = url;
  imagen.alt = `Motocicleta ${moto.placa || ""}`;
  imagen.loading = "lazy";
  imagen.referrerPolicy = "no-referrer";

  imagen.onerror = () => {
    contenedor.replaceChildren(
      crear(
        "div",
        "🏍️ No se pudo cargar la fotografía"
      )
    );
  };

  contenedor.appendChild(imagen);
}

// ==========================================
// DATOS DE LA MOTO
// ==========================================

function dibujarDatos(moto, trabajo) {
  const destino = $("moto-datos");
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

  if (trabajo?.estado === "finalizada" &&
      trabajo.fecha_entrega) {
    agregarDato(
      destino,
      "Finalización",
      fecha(trabajo.fecha_entrega)
    );
  }
}

// ==========================================
// HISTORIAL DEL SERVICIO
// ==========================================

function dibujarHistorial(trabajo, avances) {
  const destino = $("moto-historial");
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
      crear("strong", repuesto.nombre),
      crear(
        "small",
        `Cantidad: ${repuesto.cantidad}`
      )
    );

    fila.appendChild(informacion);
    destino.appendChild(fila);
  }
}

// ==========================================
// CATÁLOGO PÚBLICO
// ==========================================

async function cargarCatalogo() {
  $("mensaje-catalogo").textContent =
    "Cargando productos disponibles...";

  try {
    const { data, error } = await supabase.rpc(
      "consultar_catalogo_publico"
    );

    if (error) throw error;

    productos = Array.isArray(data) ? data : [];

    const selector = $("categoria-publica");

    selector.replaceChildren(
      new Option("Todas las categorías", "")
    );

    const categorias = [
      ...new Set(
        productos
          .map(p => p.categoria)
          .filter(Boolean)
      )
    ].sort();

    for (const categoria of categorias) {
      selector.add(
        new Option(categoria, categoria)
      );
    }

    $("mensaje-catalogo").textContent = "";

    dibujarCatalogo();

  } catch (error) {
    console.error("Error de catálogo:", error);

    $("mensaje-catalogo").textContent =
      "No se pudo cargar el catálogo: " +
      error.message;
  }
}

// ==========================================
// MOSTRAR PRODUCTOS Y SUS FOTOGRAFÍAS
// ==========================================

function dibujarCatalogo() {
  const destino = $("lista-productos-publicos");

  destino.replaceChildren();

  const busqueda = $("buscar-producto-publico")
    .value.trim().toLowerCase();

  const categoria = $("categoria-publica")
    .value.trim().toLowerCase();

  const filtrados = productos.filter(producto => {
    const texto =
      `${producto.nombre} ${producto.descripcion || ""}`
        .toLowerCase();

    return texto.includes(busqueda) &&
      (
        !categoria ||
        String(producto.categoria || "")
          .toLowerCase() === categoria
      );
  });

  if (!filtrados.length) {
    destino.appendChild(
      crear(
        "p",
        "No hay productos disponibles con ese filtro."
      )
    );
    return;
  }

  for (const producto of filtrados) {
    const tarjeta = crear(
      "article",
      "",
      "producto-publico"
    );

    const foto = crear(
      "div",
      "📦 Imagen no disponible",
      "producto-publico-imagen"
    );

    // OBTENER FOTO DEL PRODUCTO
    const urlFoto = obtenerUrlFoto(
      producto.foto_url,
      "fotos-productos"
    );

    if (urlFoto) {
      const imagen = document.createElement("img");

      imagen.src = urlFoto;
      imagen.alt = producto.nombre;
      imagen.loading = "lazy";
      imagen.referrerPolicy = "no-referrer";

      imagen.onerror = () => {
        foto.textContent =
          "📦 Imagen no disponible";
      };

      foto.replaceChildren(imagen);
    }

    const info = crear(
      "div",
      "",
      "producto-publico-info"
    );

    info.append(
      crear("h3", producto.nombre),
      crear(
        "p",
        producto.descripcion ||
          "Producto disponible."
      ),
      crear(
        "p",
        `Categoría: ${producto.categoria}`
      ),
      crear(
        "div",
        `Bs. ${Number(
          producto.precio || 0
        ).toFixed(2)}`,
        "producto-publico-precio"
      ),
      crear(
        "div",
        `Disponibles: ${producto.stock}`,
        "producto-publico-stock"
      )
    );

    tarjeta.append(foto, info);
    destino.appendChild(tarjeta);
  }
}

// ==========================================
// BUSCAR Y FILTRAR PRODUCTOS
// ==========================================

$("buscar-producto-publico").addEventListener(
  "input",
  dibujarCatalogo
);

$("categoria-publica").addEventListener(
  "change",
  dibujarCatalogo
);

// ==========================================
// BOTONES CONSULTAR DE LA PORTADA
// ==========================================

document.querySelectorAll("[data-categoria]").forEach(
  enlace => {
    enlace.addEventListener("click", () => {
      const categoriaBuscada =
        enlace.dataset.categoria.toLowerCase();

      const selector = $("categoria-publica");

      const opcion = Array.from(
        selector.options
      ).find(
        o => o.value
          .toLowerCase()
          .includes(categoriaBuscada)
      );

      selector.value = opcion
        ? opcion.value
        : "";

      dibujarCatalogo();
    });
  }
);

// ==========================================
// ACTUALIZACIONES AUTOMÁTICAS
// ==========================================

// Consulta cada 15 segundos mientras
// la página esté visible.
// No necesita acceso de escritura.
setInterval(() => {
  if (document.hidden) return;

  if (placaConsultada) {
    consultarMoto(true);
  }
}, 15000);

// Actualizar al regresar a la página.
document.addEventListener(
  "visibilitychange",
  () => {
    if (!document.hidden && placaConsultada) {
      consultarMoto(true);
    }
  }
);

// ==========================================
// INICIAR SISTEMA
// ==========================================

cargarCatalogo();
