
import { supabase } from "./supabase.js";

// ==========================================
// TALLER LUIGI BIKER - PANEL DEL CLIENTE
// ==========================================

const $ = id => document.getElementById(id);
const dinero = valor => `Bs. ${Number(valor || 0).toFixed(2)}`;

let usuario = null;
let motoActual = null;
let reparacionActual = null;
let productos = [];
let avisos = [];
let canal = null;
let primeraCarga = true;
let avisosConocidos = new Set();
let actualizando = false;
let actualizacionPendiente = false;
let consultandoAvisos = false;
let avisosPendientes = false;
let temporizadorToast = null;

function nodo(tag, texto = "", clase = "") {
  const el = document.createElement(tag);
  el.textContent = String(texto ?? "");
  if (clase) el.className = clase;
  return el;
}

function fecha(valor) {
  if (!valor) return "Fecha no registrada";

  const d = new Date(valor);

  return Number.isNaN(d.getTime())
    ? "Fecha no registrada"
    : d.toLocaleString("es-BO");
}

function textoEstado(estado) {
  return ({
    recibida: "Moto recibida",
    en_reparacion: "En reparación",
    finalizada: "Lista para entrega"
  })[estado] || estado || "Sin estado";
}

function mostrarMensaje(id, texto) {
  const elemento = $(id);
  if (elemento) elemento.textContent = texto;
}

function mostrarToast(texto) {
  const toast = $("toast");
  if (!toast) return;

  toast.textContent = "🔔 " + texto;
  toast.hidden = false;

  clearTimeout(temporizadorToast);

  temporizadorToast = setTimeout(() => {
    toast.hidden = true;
  }, 6500);
}

function agregarDato(destino, titulo, valor) {
  const fila = nodo("div", "", "dato");

  fila.append(
    nodo("span", titulo),
    nodo("strong", valor ?? "No registrado")
  );

  destino.appendChild(fila);
}

// ==========================================
// FOTOGRAFÍAS DE SUPABASE STORAGE
// ==========================================

// Los buckets fotos-motos y fotos-productos
// están configurados como públicos.
//
// La base de datos puede guardar:
// motocicletas/archivo.jpg
// productos/archivo.jpg
//
// Esta función convierte esas rutas en URLs
// públicas que el navegador puede mostrar.

function obtenerUrlFoto(rutaGuardada, bucket) {
  const ruta = String(rutaGuardada || "").trim();

  if (!ruta) return null;

  // Si ya es una URL HTTPS completa.
  if (/^https:\/\//i.test(ruta)) {
    return ruta;
  }

  // Rechazar otros esquemas.
  if (/^[a-z][a-z0-9+.-]*:/i.test(ruta)) {
    return null;
  }

  // Evitar repetir el nombre del bucket.
  const prefijo = `${bucket}/`;

  const rutaLimpia = ruta.startsWith(prefijo)
    ? ruta.slice(prefijo.length)
    : ruta;

  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(rutaLimpia);

  return data?.publicUrl || null;
}

function urlFotoMoto(ruta) {
  return obtenerUrlFoto(ruta, "fotos-motos");
}

function urlFotoProducto(ruta) {
  return obtenerUrlFoto(ruta, "fotos-productos");
}

// ==========================================
// NAVEGACIÓN
// ==========================================

document.querySelectorAll("[data-seccion]").forEach(boton => {
  boton.addEventListener("click", () => {
    const destino = boton.dataset.seccion;

    document.querySelectorAll(".seccion").forEach(seccion => {
      seccion.hidden = seccion.id !== destino;
    });

    document.querySelectorAll("[data-seccion]").forEach(b => {
      b.classList.toggle("menu-activo", b === boton);
    });

    if (destino === "tienda") cargarTienda();
    if (destino === "notificaciones") cargarAvisos();
  });
});

// ==========================================
// AUTENTICACIÓN
// ==========================================

async function iniciar() {
  try {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      location.replace("./login.html");
      return;
    }

    const {
      data: perfil,
      error: errorPerfil
    } = await supabase
      .from("perfiles")
      .select("nombre,rol,activo")
      .eq("id", data.user.id)
      .single();

    if (errorPerfil) throw errorPerfil;

    if (!perfil || perfil.rol !== "cliente" || !perfil.activo) {
      $("cargando").textContent =
        "Esta cuenta no tiene acceso al panel del cliente.";
      return;
    }

    usuario = data.user;

    $("nombre-cliente").textContent = perfil.nombre;
    $("cargando").hidden = true;
    $("app").hidden = false;

    await Promise.all([
      cargarTienda(),
      cargarAvisos()
    ]);

    activarRealtime();

  } catch (error) {
    console.error(error);

    $("cargando").textContent =
      "Error al abrir el panel: " + error.message;
  }
}

// ==========================================
// BÚSQUEDA POR PLACA
// ==========================================

$("form-buscar").addEventListener("submit", async evento => {
  evento.preventDefault();
  await buscarMoto();
});

async function buscarMoto(silencioso = false) {
  if (!usuario) return;

  if (actualizando) {
    actualizacionPendiente = true;
    return;
  }

  const placa = $("placa").value.trim().toUpperCase();

  if (!placa) {
    mostrarMensaje(
      "mensaje-busqueda",
      "Escribe la placa de tu moto."
    );
    return;
  }

  actualizando = true;
  $("btn-buscar").disabled = true;

  if (!silencioso) {
    mostrarMensaje(
      "mensaje-busqueda",
      "Buscando motocicleta..."
    );
  }

  try {
    // Solo motocicletas vinculadas al cliente.
    // Supabase RLS sigue aplicándose.
    const { data: motos, error } = await supabase
      .from("motocicletas")
      .select("id,placa,marca,modelo,color,foto_url")
      .eq("propietario_id", usuario.id)
      .ilike("placa", placa)
      .limit(1);

    if (error) throw error;

    if (!motos?.length) {
      motoActual = null;
      reparacionActual = null;

      $("resultado").hidden = true;

      mostrarMensaje(
        "mensaje-busqueda",
        "No encontramos una motocicleta vinculada a tu cuenta " +
        "con esa placa. Verifica la placa o consulta al taller."
      );

      return;
    }

    const moto = motos[0];

    const {
      data: trabajos,
      error: errorTrabajos
    } = await supabase
      .from("reparaciones")
      .select(
        "id,moto_id,descripcion,diagnostico,estado," +
        "fecha_ingreso,fecha_entrega,costo_mano_obra," +
        "mostrar_mano_obra"
      )
      .eq("moto_id", moto.id)
      .order("id", { ascending: false })
      .limit(1);

    if (errorTrabajos) throw errorTrabajos;

    motoActual = moto;
    reparacionActual = trabajos?.[0] || null;

    let avances = [];
    let repuestos = [];

    if (reparacionActual) {
      const [
        respuestaAvances,
        respuestaRepuestos
      ] = await Promise.all([
        supabase
          .from("avances_reparacion")
          .select("id,descripcion,creado_en")
          .eq("reparacion_id", reparacionActual.id)
          .order("creado_en", { ascending: true }),

        supabase
          .from("repuestos_trabajo_mecanico")
          .select("id,nombre,cantidad,precio_unitario")
          .eq("reparacion_id", reparacionActual.id)
          .order("id", { ascending: true })
      ]);

      if (respuestaAvances.error) {
        throw respuestaAvances.error;
      }

      if (respuestaRepuestos.error) {
        throw respuestaRepuestos.error;
      }

      avances = respuestaAvances.data || [];
      repuestos = respuestaRepuestos.data || [];
    }

    dibujarMoto(
      moto,
      reparacionActual,
      avances,
      repuestos
    );

    $("resultado").hidden = false;
    mostrarMensaje("mensaje-busqueda", "");

  } catch (error) {
    console.error("Error al buscar moto:", error);

    mostrarMensaje(
      "mensaje-busqueda",
      "No se pudo consultar la motocicleta: " +
      error.message
    );

  } finally {
    actualizando = false;
    $("btn-buscar").disabled = false;

    if (actualizacionPendiente) {
      actualizacionPendiente = false;
      buscarMoto(true);
    }
  }
}

// ==========================================
// DIBUJAR SEGUIMIENTO DE LA MOTOCICLETA
// ==========================================

function dibujarMoto(moto, trabajo, avances, repuestos) {
  $("titulo-moto").textContent =
    `${moto.marca || "Motocicleta"} ${moto.modelo || ""}`;

  $("subtitulo-moto").textContent =
    `Placa ${moto.placa} · ${
      trabajo ? `Orden #${trabajo.id}` : "Sin orden activa"
    }`;

  const estado = trabajo?.estado || "sin_reparacion";

  $("estado-principal").textContent = textoEstado(estado);

  $("estado-principal").className =
    `estado ${estado === "finalizada" ? "finalizada" : ""}`;

  $("estado-resumen").textContent =
    "● " + textoEstado(estado);

  const titulos = {
    recibida: "HEMOS RECIBIDO TU MOTO",
    en_reparacion: "ESTAMOS TRABAJANDO EN TU MOTO",
    finalizada: "¡TU MOTO ESTÁ LISTA!"
  };

  $("titulo-estado").textContent =
    titulos[estado] || "SEGUIMIENTO DE TU MOTOCICLETA";

  $("descripcion-estado").textContent =
    trabajo?.descripcion ||
    "Todavía no hay una reparación registrada para esta moto.";

  // ========================================
  // FOTO REAL DE LA MOTOCICLETA
  // ========================================

  const contenedor = $("contenedor-foto");
  contenedor.replaceChildren();

  const url = urlFotoMoto(moto.foto_url);

  if (url) {
    const imagen = document.createElement("img");

    imagen.src = url;
    imagen.alt = `Fotografía de ${moto.placa}`;
    imagen.loading = "lazy";
    imagen.referrerPolicy = "no-referrer";

    imagen.onerror = () => {
      contenedor.replaceChildren(
        nodo(
          "div",
          "🏍️ No se pudo cargar la fotografía",
          "sin-foto"
        )
      );
    };

    contenedor.appendChild(imagen);

  } else {
    contenedor.appendChild(
      nodo(
        "div",
        "🏍️ Fotografía no disponible",
        "sin-foto"
      )
    );
  }

  // ========================================
  // DATOS DE LA MOTOCICLETA
  // ========================================

  const datos = $("datos-moto");
  datos.replaceChildren();

  agregarDato(datos, "Placa", moto.placa);
  agregarDato(datos, "Marca", moto.marca);
  agregarDato(datos, "Modelo", moto.modelo);
  agregarDato(datos, "Color", moto.color);

  if (trabajo) {
    agregarDato(
      datos,
      "Fecha de ingreso",
      fecha(trabajo.fecha_ingreso)
    );

    if (trabajo.diagnostico) {
      agregarDato(
        datos,
        "Diagnóstico",
        trabajo.diagnostico
      );
    }

    if (trabajo.fecha_entrega) {
      agregarDato(
        datos,
        "Fecha de entrega",
        fecha(trabajo.fecha_entrega)
      );
    }
  }

  dibujarHistorial(trabajo, avances);
  dibujarRepuestos(trabajo, repuestos);

  $("panel-comprobante").hidden =
    trabajo?.estado !== "finalizada";
}

// ==========================================
// HISTORIAL VISUAL
// ==========================================

function agregarEvento(
  destino,
  titulo,
  descripcion,
  fechaEvento,
  pendiente
) {
  const evento = nodo(
    "div",
    "",
    pendiente ? "evento pendiente" : "evento"
  );

  const punto = nodo(
    "div",
    pendiente ? "" : "✓",
    "punto"
  );

  const contenido = nodo(
    "div",
    "",
    "contenido-evento"
  );

  contenido.append(
    nodo("h4", titulo),
    nodo("p", descripcion),
    nodo("small", fechaEvento)
  );

  evento.append(punto, contenido);
  destino.appendChild(evento);
}

function dibujarHistorial(trabajo, avances) {
  const historial = $("historial");
  historial.replaceChildren();

  if (!trabajo) {
    agregarEvento(
      historial,
      "Sin reparación registrada",
      "El taller todavía no ha registrado un trabajo para esta moto.",
      "PENDIENTE",
      true
    );
    return;
  }

  agregarEvento(
    historial,
    "Moto recibida",
    trabajo.descripcion,
    fecha(trabajo.fecha_ingreso),
    false
  );

  if (trabajo.diagnostico) {
    agregarEvento(
      historial,
      "Diagnóstico registrado",
      trabajo.diagnostico,
      "REGISTRADO",
      false
    );
  }

  for (const avance of avances) {
    agregarEvento(
      historial,
      "Avance del mecánico",
      avance.descripcion,
      fecha(avance.creado_en),
      false
    );
  }

  const enReparacion = [
    "en_reparacion",
    "finalizada"
  ].includes(trabajo.estado);

  agregarEvento(
    historial,
    "Reparación en proceso",
    enReparacion
      ? "El taller está trabajando en tu motocicleta."
      : "Esperando el inicio de los trabajos.",
    enReparacion ? "ETAPA ALCANZADA" : "PENDIENTE",
    !enReparacion
  );

  const finalizada = trabajo.estado === "finalizada";

  agregarEvento(
    historial,
    "Lista para despacho",
    finalizada
      ? "Reparación finalizada. Comprobante disponible."
      : "Pendiente de finalización y entrega.",
    finalizada
      ? fecha(trabajo.fecha_entrega)
      : "PENDIENTE",
    !finalizada
  );
}

// ==========================================
// REPUESTOS Y COSTOS
// ==========================================

function dibujarRepuestos(trabajo, repuestos) {
  const lista = $("lista-repuestos");
  const resumen = $("resumen-costos");

  lista.replaceChildren();
  resumen.replaceChildren();

  if (!repuestos.length) {
    lista.appendChild(
      nodo(
        "p",
        "Todavía no hay repuestos registrados."
      )
    );
  }

  let totalRepuestos = 0;

  for (const repuesto of repuestos) {
    const subtotal =
      Number(repuesto.cantidad) *
      Number(repuesto.precio_unitario);

    totalRepuestos += subtotal;

    const fila = nodo("div", "", "repuesto");
    const info = nodo("div");

    info.append(
      nodo("strong", repuesto.nombre),
      nodo("small", `Cantidad: ${repuesto.cantidad}`)
    );

    fila.append(
      info,
      nodo("strong", dinero(subtotal))
    );

    lista.appendChild(fila);
  }

  if (trabajo?.mostrar_mano_obra) {
    agregarDato(
      resumen,
      "Mano de obra",
      dinero(trabajo.costo_mano_obra)
    );
  }

  const total = nodo("div", "", "total");

  total.append(
    nodo(
      "span",
      trabajo?.mostrar_mano_obra
        ? "TOTAL REGISTRADO"
        : "SUBTOTAL REPUESTOS"
    ),
    nodo(
      "strong",
      dinero(
        totalRepuestos +
        (
          trabajo?.mostrar_mano_obra
            ? Number(trabajo.costo_mano_obra || 0)
            : 0
        )
      )
    )
  );

  resumen.appendChild(total);
}

// ==========================================
// COMPROBANTE
// ==========================================

$("descargar-pdf").addEventListener("click", () => {
  if (
    !reparacionActual ||
    reparacionActual.estado !== "finalizada"
  ) {
    return;
  }

  const url = new URL(
    "./cliente-comprobante.html",
    location.href
  );

  url.searchParams.set(
    "id",
    reparacionActual.id
  );

  window.open(
    url.href,
    "_blank",
    "noopener"
  );
});

// ==========================================
// TIENDA / INVENTARIO
// ==========================================

async function cargarTienda() {
  try {
    const { data, error } = await supabase
      .from("productos")
      .select(
        "id,nombre,descripcion,categoria,precio," +
        "stock,foto_url,activo"
      )
      .eq("activo", true)
      .gt("stock", 0)
      .order("nombre");

    if (error) throw error;

    productos = data || [];

    const selector = $("categoria");
    const anterior = selector.value;

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

    selector.value = categorias.includes(anterior)
      ? anterior
      : "";

    dibujarProductos();

    mostrarMensaje("mensaje-tienda", "");

  } catch (error) {
    console.error("Error de tienda:", error);

    mostrarMensaje(
      "mensaje-tienda",
      "No se pudo cargar la tienda: " +
      error.message
    );
  }
}

// ==========================================
// MOSTRAR PRODUCTOS CON FOTOGRAFÍAS
// ==========================================

function dibujarProductos() {
  const contenedor = $("productos");

  const busqueda = $("buscar-producto")
    .value.trim().toLowerCase();

  const categoria = $("categoria").value;

  const filtrados = productos.filter(producto => {
    const texto =
      `${producto.nombre} ${producto.descripcion || ""}`
        .toLowerCase();

    return texto.includes(busqueda) &&
      (!categoria || producto.categoria === categoria);
  });

  contenedor.replaceChildren();

  if (!filtrados.length) {
    contenedor.appendChild(
      nodo(
        "p",
        "No encontramos productos disponibles con ese filtro."
      )
    );
    return;
  }

  for (const producto of filtrados) {
    const tarjeta = nodo(
      "article",
      "",
      "producto"
    );

    // FOTO REAL DEL PRODUCTO
    const url = urlFotoProducto(
      producto.foto_url
    );

    if (url) {
      const imagen = document.createElement("img");

      imagen.className = "foto-producto";
      imagen.src = url;
      imagen.alt = producto.nombre;
      imagen.loading = "lazy";
      imagen.referrerPolicy = "no-referrer";

      imagen.onerror = () => {
        const sinFoto = nodo(
          "div",
          "📦 Imagen no disponible",
          "sin-foto foto-producto"
        );

        imagen.replaceWith(sinFoto);
      };

      tarjeta.appendChild(imagen);

    } else {
      const sinFoto = nodo(
        "div",
        "📦 Imagen no disponible",
        "sin-foto foto-producto"
      );

      tarjeta.appendChild(sinFoto);
    }

    const info = nodo(
      "div",
      "",
      "producto-info"
    );

    info.append(
      nodo("h3", producto.nombre),
      nodo(
        "p",
        producto.descripcion || "Producto disponible"
      ),
      nodo(
        "p",
        `Categoría: ${producto.categoria}`
      ),
      nodo(
        "div",
        dinero(producto.precio),
        "producto-precio"
      ),
      nodo(
        "span",
        `Existencias: ${producto.stock}`,
        "producto-stock"
      )
    );

    tarjeta.appendChild(info);
    contenedor.appendChild(tarjeta);
  }
}

$("buscar-producto").addEventListener(
  "input",
  dibujarProductos
);

$("categoria").addEventListener(
  "change",
  dibujarProductos
);

// ==========================================
// NOTIFICACIONES
// ==========================================

async function cargarAvisos() {
  if (!usuario) return;

  if (consultandoAvisos) {
    avisosPendientes = true;
    return;
  }

  consultandoAvisos = true;

  try {
    const { data, error } = await supabase
      .from("notificaciones_cliente")
      .select(
        "id,titulo,mensaje,tipo,leida,creado_en"
      )
      .eq("cliente_id", usuario.id)
      .order("creado_en", { ascending: false })
      .limit(100);

    if (error) throw error;

    const nuevosAvisos = data || [];

    if (!primeraCarga) {
      const nuevos = nuevosAvisos.filter(
        aviso => !avisosConocidos.has(aviso.id)
      );

      if (nuevos.length) {
        mostrarToast(
          `${nuevos[0].titulo}: ${nuevos[0].mensaje}`
        );
      }
    }

    nuevosAvisos.forEach(aviso => {
      avisosConocidos.add(aviso.id);
    });

    primeraCarga = false;
    avisos = nuevosAvisos;

    dibujarAvisos();

    mostrarMensaje("mensaje-avisos", "");

  } catch (error) {
    console.error("Error de avisos:", error);

    mostrarMensaje(
      "mensaje-avisos",
      "No se pudieron consultar los avisos: " +
      error.message
    );

  } finally {
    consultandoAvisos = false;

    if (avisosPendientes) {
      avisosPendientes = false;
      cargarAvisos();
    }
  }
}

function dibujarAvisos() {
  const contenedor = $("avisos");
  contenedor.replaceChildren();

  const sinLeer = avisos.filter(
    a => !a.leida
  ).length;

  $("cantidad-avisos").textContent = sinLeer;
  $("cantidad-avisos").hidden = sinLeer === 0;

  if (!avisos.length) {
    contenedor.appendChild(
      nodo(
        "p",
        "Todavía no tienes notificaciones."
      )
    );
    return;
  }

  for (const aviso of avisos) {
    const tarjeta = nodo(
      "article",
      "",
      aviso.leida ? "aviso" : "aviso nuevo"
    );

    tarjeta.append(
      nodo("h3", aviso.titulo),
      nodo("p", aviso.mensaje),
      nodo("small", fecha(aviso.creado_en))
    );

    if (!aviso.leida) {
      const boton = nodo(
        "button",
        "Marcar como leída"
      );

      boton.addEventListener("click", async () => {
        boton.disabled = true;
        await marcarLeidas([aviso.id]);
        boton.disabled = false;
      });

      tarjeta.appendChild(boton);
    }

    contenedor.appendChild(tarjeta);
  }
}

async function marcarLeidas(ids) {
  if (!ids.length) return;

  const { error } = await supabase
    .from("notificaciones_cliente")
    .update({ leida: true })
    .eq("cliente_id", usuario.id)
    .in("id", ids);

  if (error) {
    mostrarMensaje(
      "mensaje-avisos",
      error.message
    );
    return;
  }

  await cargarAvisos();
}

$("marcar-todas").addEventListener(
  "click",
  async () => {
    const ids = avisos
      .filter(a => !a.leida)
      .map(a => a.id);

    await marcarLeidas(ids);
  }
);

// ==========================================
// ACTUALIZACIÓN EN TIEMPO REAL
// ==========================================

function activarRealtime() {
  canal = supabase
    .channel(`cliente-avisos-${usuario.id}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notificaciones_cliente",
        filter: `cliente_id=eq.${usuario.id}`
      },
      () => {
        cargarAvisos();

        if (motoActual) {
          buscarMoto(true);
        }
      }
    )
    .subscribe();
}

// Respaldo cada 15 segundos.
setInterval(() => {
  if (!usuario || document.hidden) return;

  cargarAvisos();

  if (motoActual) {
    buscarMoto(true);
  }
}, 15000);

document.addEventListener(
  "visibilitychange",
  () => {
    if (!document.hidden && usuario) {
      cargarAvisos();

      if (motoActual) {
        buscarMoto(true);
      }
    }
  }
);

// ==========================================
// CERRAR SESIÓN
// ==========================================

$("salir").addEventListener("click", async () => {
  if (canal) {
    await supabase.removeChannel(canal);
  }

  const { error } = await supabase.auth.signOut();

  if (error) {
    alert(
      "Error al cerrar sesión: " +
      error.message
    );
    return;
  }

  location.replace("./login.html");
});

// ==========================================
// INICIAR PANEL
// ==========================================

iniciar();
