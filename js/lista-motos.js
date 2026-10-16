
import { supabase } from "./supabase.js";

// ==========================================
// TALLER LUIGI BIKER
// LISTADO Y ELIMINACIÓN DE MOTOCICLETAS
// ==========================================

const $ = (id) => document.getElementById(id);

const verificando = $("verificando");
const contenido = $("contenido");
const lista = $("lista");
const mensaje = $("mensaje");
const buscar = $("buscar");
const actualizar = $("actualizar");

let motocicletas = [];
let autorizado = false;
let eliminando = false;

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

function crear(tipo, texto = "", clase = "") {
  const elemento = document.createElement(tipo);

  elemento.textContent = String(texto ?? "");

  if (clase) {
    elemento.className = clase;
  }

  return elemento;
}

function agregarDato(contenedor, titulo, valor) {
  const p = document.createElement("p");
  const strong = document.createElement("strong");

  strong.textContent = titulo + ": ";

  p.append(
    strong,
    document.createTextNode(
      String(valor ?? "").trim() || "No registrado"
    )
  );

  contenedor.appendChild(p);
}

function avisar(texto, error = false) {
  mensaje.textContent = texto;
  mensaje.style.color = error
    ? "#ff8585"
    : "#cccccc";
}

function obtenerMensajeError(error) {
  if (typeof error === "string") {
    return error;
  }

  if (error?.message) {
    return error.message;
  }

  if (error?.details) {
    return error.details;
  }

  if (error?.hint) {
    return error.hint;
  }

  try {
    return JSON.stringify(error) || "Error desconocido.";
  } catch {
    return "Error desconocido.";
  }
}

// ==========================================
// ACCESO DE ADMINISTRADOR
// ==========================================

async function verificarAcceso() {
  try {
    const { data, error } =
      await supabase.auth.getUser();

    if (error || !data?.user) {
      location.replace("./login.html");
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

    if (errorPerfil) {
      throw errorPerfil;
    }

    if (
      !perfil ||
      perfil.rol !== "admin" ||
      perfil.activo !== true
    ) {
      throw new Error(
        "Acceso denegado. Solo administradores activos."
      );
    }

    autorizado = true;

    verificando.hidden = true;
    contenido.hidden = false;

    await cargarMotocicletas();

  } catch (error) {
    console.error(
      "Error al verificar acceso:",
      error
    );

    verificando.textContent =
      "Error de acceso: " +
      obtenerMensajeError(error);
  }
}

// ==========================================
// CARGAR MOTOCICLETAS
// ==========================================

async function cargarMotocicletas() {
  if (!autorizado) {
    return;
  }

  actualizar.disabled = true;

  avisar("Cargando motocicletas...");

  try {
    const { data, error } = await supabase
      .from("motocicletas")
      .select(
        "id,placa,nombre_propietario," +
        "celular_propietario,marca,modelo," +
        "color,observaciones,foto_url,creado_en"
      )
      .order("creado_en", {
        ascending: false
      })
      .limit(100);

    if (error) {
      throw error;
    }

    motocicletas = await Promise.all(
      (data || []).map(async (moto) => {
        let fotoTemporal = null;

        if (moto.foto_url) {
          // Si ya es una URL completa,
          // utilizarla directamente.
          if (/^https?:\/\//i.test(moto.foto_url)) {
            fotoTemporal = moto.foto_url;

          } else {
            // Crear URL temporal para foto privada.
            const {
              data: foto,
              error: errorFoto
            } = await supabase.storage
              .from("fotos-motos")
              .createSignedUrl(
                moto.foto_url,
                3600
              );

            if (!errorFoto && foto) {
              fotoTemporal = foto.signedUrl;
            }
          }
        }

        return {
          ...moto,
          fotoTemporal
        };
      })
    );

    mostrarMotocicletas();

  } catch (error) {
    console.error(
      "Error al cargar motocicletas:",
      error
    );

    lista.replaceChildren();

    avisar(
      "No se pudieron cargar las motos: " +
      obtenerMensajeError(error),
      true
    );

  } finally {
    actualizar.disabled = false;
  }
}

// ==========================================
// ELIMINAR MOTOCICLETA
// SOLO ACEPTAR O CANCELAR
// ==========================================

async function eliminarMoto(
  moto,
  boton,
  resultado
) {
  if (!autorizado || eliminando) {
    return;
  }

  // UNA SOLA CONFIRMACIÓN
  // NO SE PIDE ESCRIBIR "ELIMINAR"

  const confirmado = window.confirm(
    `¿Estás seguro de eliminar definitivamente ` +
    `la motocicleta ${moto.placa}?\n\n` +
    `Marca: ${moto.marca || "No registrada"}\n` +
    `Modelo: ${moto.modelo || "No registrado"}\n` +
    `Propietario: ${
      moto.nombre_propietario || "No registrado"
    }\n\n` +
    "También se eliminarán sus reparaciones " +
    "y registros relacionados, si la función " +
    "de Supabase está configurada para ello.\n\n" +
    "Las cuentas de clientes y mecánicos " +
    "se conservarán.\n\n" +
    "ESTA ACCIÓN NO SE PUEDE DESHACER."
  );

  if (!confirmado) {
    resultado.textContent =
      "Eliminación cancelada.";

    resultado.style.color = "#cccccc";
    return;
  }

  eliminando = true;

  boton.disabled = true;
  boton.textContent = "Eliminando...";

  resultado.textContent =
    "Solicitando eliminación de la motocicleta...";

  resultado.style.color = "#cccccc";

  try {
    // ======================================
    // COMPROBAR SESIÓN
    // ======================================

    const {
      data: sesion,
      error: errorSesion
    } = await supabase.auth.getSession();

    if (
      errorSesion ||
      !sesion?.session?.access_token
    ) {
      throw new Error(
        "Tu sesión caducó. Inicia sesión nuevamente."
      );
    }

    // ======================================
    // LLAMAR FUNCIÓN SEGURA DE SUPABASE
    // ======================================

    const { error } = await supabase.rpc(
      "eliminar_moto_admin",
      {
        p_moto_id: String(moto.id)
      }
    );

    if (error) {
      throw error;
    }

    // ======================================
    // ACTUALIZAR LISTA
    // ======================================

    await cargarMotocicletas();

    avisar(
      `La motocicleta ${moto.placa} ` +
      "fue eliminada correctamente."
    );

    mensaje.style.color = "#69e4a2";

  } catch (error) {
    console.error(
      "Error al eliminar motocicleta:",
      error
    );

    resultado.textContent =
      "No se pudo eliminar:\n" +
      obtenerMensajeError(error);

    resultado.style.color = "#ff8585";
    resultado.style.whiteSpace = "pre-line";

  } finally {
    eliminando = false;

    if (boton.isConnected) {
      boton.disabled = false;
      boton.textContent = "🗑️ Eliminar";
    }
  }
}

// ==========================================
// MOSTRAR MOTOCICLETAS
// ==========================================

function mostrarMotocicletas() {
  const texto = buscar.value
    .trim()
    .toLowerCase();

  const filtradas = motocicletas.filter(
    (moto) => {
      return [
        moto.placa,
        moto.marca,
        moto.modelo,
        moto.nombre_propietario
      ].some(
        (valor) =>
          String(valor || "")
            .toLowerCase()
            .includes(texto)
      );
    }
  );

  lista.replaceChildren();

  if (!filtradas.length) {
    avisar(
      texto
        ? "No se encontraron motocicletas."
        : "Todavía no hay motocicletas registradas."
    );

    return;
  }

  avisar(
    `Mostrando ${filtradas.length} motocicleta(s). ` +
    "Máximo 100 registros recientes."
  );

  for (const moto of filtradas) {
    const tarjeta = crear(
      "article",
      "",
      "moto-card"
    );

    // ======================================
    // FOTOGRAFÍA
    // ======================================

    if (moto.fotoTemporal) {
      const img = document.createElement("img");

      img.className = "moto-imagen";
      img.src = moto.fotoTemporal;
      img.alt =
        "Motocicleta " + moto.placa;
      img.loading = "lazy";

      img.addEventListener(
        "error",
        () => {
          img.replaceWith(
            crear(
              "div",
              "🏍️",
              "sin-imagen"
            )
          );
        }
      );

      tarjeta.appendChild(img);

    } else {
      tarjeta.appendChild(
        crear(
          "div",
          "🏍️",
          "sin-imagen"
        )
      );
    }

    // ======================================
    // INFORMACIÓN
    // ======================================

    const info = crear(
      "div",
      "",
      "moto-info"
    );

    info.appendChild(
      crear(
        "h2",
        moto.placa || "Sin placa"
      )
    );

    agregarDato(
      info,
      "Marca",
      moto.marca
    );

    agregarDato(
      info,
      "Modelo",
      moto.modelo
    );

    agregarDato(
      info,
      "Color",
      moto.color
    );

    agregarDato(
      info,
      "Propietario",
      moto.nombre_propietario
    );

    agregarDato(
      info,
      "Celular",
      moto.celular_propietario
    );

    agregarDato(
      info,
      "Observaciones",
      moto.observaciones
    );

    // ======================================
    // FECHA DE REGISTRO
    // ======================================

    if (moto.creado_en) {
      const fecha = crear(
        "small",
        "Registrada: " +
        new Date(
          moto.creado_en
        ).toLocaleString("es-BO"),
        "fecha"
      );

      info.appendChild(fecha);
    }

    // ======================================
    // BOTÓN ELIMINAR
    // ======================================

    const acciones = crear(
      "div",
      "",
      "acciones-moto"
    );

    const botonEliminar = crear(
      "button",
      "🗑️ Eliminar",
      "btn-eliminar"
    );

    botonEliminar.type = "button";

    const resultado = crear(
      "p",
      "",
      "resultado"
    );

    resultado.setAttribute(
      "role",
      "status"
    );

    botonEliminar.addEventListener(
      "click",
      () => eliminarMoto(
        moto,
        botonEliminar,
        resultado
      )
    );

    acciones.appendChild(
      botonEliminar
    );

    info.append(
      acciones,
      resultado
    );

    tarjeta.appendChild(info);
    lista.appendChild(tarjeta);
  }
}

// ==========================================
// EVENTOS
// ==========================================

buscar.addEventListener(
  "input",
  mostrarMotocicletas
);

actualizar.addEventListener(
  "click",
  cargarMotocicletas
);

// ==========================================
// INICIAR
// ==========================================

verificarAcceso();
