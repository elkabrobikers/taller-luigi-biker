
import { supabase } from "./supabase.js";
import { prepararRegistro } from "./registro-usuarios.js";

// ==========================================
// TALLER LUIGI BIKER
// GESTIÓN DE MECÁNICOS
// ==========================================

const FUNCION_ELIMINAR = "rapid-api";

const $ = (id) => document.getElementById(id);

let autorizado = false;
let mecanicos = [];
let eliminando = false;

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

function crear(tipo, texto = "", clase = "") {
  const elemento = document.createElement(tipo);
  elemento.textContent = String(texto ?? "");
  elemento.className = clase;
  return elemento;
}

function crearCampo(etiqueta, valor, tipo = "text") {
  const contenedor = crear("div", "", "campo");
  const label = crear("label", etiqueta);

  const input = document.createElement("input");
  input.type = tipo;
  input.value = valor || "";

  contenedor.append(label, input);

  return { contenedor, input };
}

function mostrarResultado(
  elemento,
  texto,
  correcto = false
) {
  elemento.textContent = texto;
  elemento.style.color = correcto
    ? "#69e4a2"
    : "#ff8585";
  elemento.style.whiteSpace = "pre-line";
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

  try {
    return JSON.stringify(error) || "Error desconocido.";
  } catch {
    return "Error desconocido.";
  }
}

async function leerErrorFuncion(error) {
  let mensaje = obtenerMensajeError(error);

  if (error?.context instanceof Response) {
    const respuesta = error.context;

    try {
      const cuerpo = await respuesta.clone().json();

      mensaje =
        cuerpo?.error ||
        cuerpo?.message ||
        mensaje;
    } catch {
      // Mantener el mensaje disponible
    }

    return `HTTP ${respuesta.status}: ${mensaje}`;
  }

  return mensaje;
}

// ==========================================
// VERIFICAR ADMINISTRADOR
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

    $("verificando").hidden = true;
    $("contenido").hidden = false;

    // Mantener el registro de mecánicos
    prepararRegistro({
      formularioId: "form-registro",
      mensajeId: "mensaje-registro",
      botonId: "crear-cuenta",
      rol: "mecanico",
      alCrear: cargarMecanicos
    });

    await cargarMecanicos();

  } catch (error) {
    console.error(
      "Error al verificar acceso:",
      error
    );

    $("verificando").textContent =
      "Error de acceso: " +
      obtenerMensajeError(error);
  }
}

// ==========================================
// CARGAR MECÁNICOS
// ==========================================

async function cargarMecanicos() {
  if (!autorizado) return;

  $("actualizar").disabled = true;

  $("mensaje").textContent =
    "Cargando mecánicos...";

  try {
    const { data, error } = await supabase
      .from("perfiles")
      .select("id,nombre,celular,rol,activo")
      .eq("rol", "mecanico")
      .order("nombre")
      .limit(200);

    if (error) {
      throw error;
    }

    mecanicos = data || [];

    mostrarMecanicos();

  } catch (error) {
    console.error(
      "Error al cargar mecánicos:",
      error
    );

    $("mensaje").textContent =
      "Error al cargar mecánicos: " +
      obtenerMensajeError(error);

    $("mensaje").style.color = "#ff8585";

  } finally {
    $("actualizar").disabled = false;
  }
}

// ==========================================
// ELIMINAR MECÁNICO DEFINITIVAMENTE
// ==========================================

async function eliminarMecanico(
  mecanico,
  boton,
  resultado
) {
  if (!autorizado || eliminando) {
    return;
  }

  // Una sola confirmación.
  // No se pide escribir ELIMINAR.
  const confirmado = window.confirm(
    `¿Eliminar definitivamente a ${mecanico.nombre}?\n\n` +
    "También se eliminarán sus reparaciones, " +
    "avances, repuestos asociados, historiales " +
    "y facturas relacionadas.\n\n" +
    "Las cuentas de clientes y sus motocicletas " +
    "no deben eliminarse.\n\n" +
    "ESTA ACCIÓN NO SE PUEDE DESHACER.\n\n" +
    "Aceptar = Eliminar\n" +
    "Cancelar = Conservar"
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
    "Solicitando eliminación de cuenta y trabajos...";

  resultado.style.color = "#cccccc";

  try {
    // Comprobar que la sesión siga activa
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

    // La eliminación se realiza en el servidor.
    // Nunca borrar tablas directamente desde aquí.
    const { data, error } =
      await supabase.functions.invoke(
        FUNCION_ELIMINAR,
        {
          body: {
            tipo: "mecanico",
            id: mecanico.id
          }
        }
      );

    if (error) {
      throw new Error(
        await leerErrorFuncion(error)
      );
    }

    if (!data?.ok) {
      throw new Error(
        data?.error ||
        "El servidor no confirmó la eliminación."
      );
    }

    // Actualizar lista después de confirmar éxito
    await cargarMecanicos();

    const cantidad = Number(
      data.trabajos_eliminados || 0
    );

    $("mensaje").textContent =
      `Mecánico ${mecanico.nombre} eliminado ` +
      `correctamente. Reparaciones eliminadas: ` +
      `${cantidad}.`;

    $("mensaje").style.color = "#69e4a2";

  } catch (error) {
    console.error(
      "Error al eliminar mecánico:",
      error
    );

    mostrarResultado(
      resultado,
      "No se pudo completar la eliminación:\n" +
      obtenerMensajeError(error) +
      "\n\nRevisa los registros antes de volver " +
      "a intentarlo, porque el servidor podría " +
      "haber eliminado parte de los datos."
    );

  } finally {
    eliminando = false;

    // Solo restaurar si la tarjeta sigue visible
    if (boton.isConnected) {
      boton.disabled = false;
      boton.textContent = "🗑️ Eliminar";
    }
  }
}

// ==========================================
// MOSTRAR MECÁNICOS
// ==========================================

function mostrarMecanicos() {
  const filtro = $("buscar")
    .value.trim().toLowerCase();

  const encontrados = mecanicos.filter(
    (mecanico) => {
      const texto = [
        mecanico.nombre || "",
        mecanico.celular || ""
      ].join(" ").toLowerCase();

      return texto.includes(filtro);
    }
  );

  $("lista").replaceChildren();

  $("mensaje").textContent =
    `Mostrando ${encontrados.length} mecánico(s).`;

  $("mensaje").style.color = "";

  if (encontrados.length === 0) {
    $("lista").appendChild(
      crear(
        "p",
        "No se encontraron mecánicos."
      )
    );

    return;
  }

  for (const mecanico of encontrados) {
    const tarjeta = crear(
      "article",
      "",
      "mecanico"
    );

    const titulo = crear(
      "h3",
      "👨‍🔧 " +
      (mecanico.nombre || "Sin nombre")
    );

    const campos = crear(
      "div",
      "",
      "campos"
    );

    const nombre = crearCampo(
      "Nombre",
      mecanico.nombre
    );

    const celular = crearCampo(
      "Celular",
      mecanico.celular,
      "tel"
    );

    campos.append(
      nombre.contenedor,
      celular.contenedor
    );

    const acciones = crear(
      "div",
      "",
      "acciones"
    );

    const estado = crear(
      "span",
      mecanico.activo
        ? "Activo"
        : "Inactivo",
      "estado" +
      (mecanico.activo ? "" : " inactivo")
    );

    const botonGuardar = crear(
      "button",
      "Guardar cambios"
    );

    botonGuardar.type = "button";

    const botonEstado = crear(
      "button",
      mecanico.activo
        ? "Desactivar"
        : "Activar",
      "btn-secundario"
    );

    botonEstado.type = "button";

    const botonEliminar = crear(
      "button",
      "🗑️ Eliminar",
      "btn-eliminar"
    );

    botonEliminar.type = "button";
    botonEliminar.style.background = "#91252d";
    botonEliminar.style.color = "#ffffff";

    const resultado = crear(
      "p",
      "",
      "resultado"
    );

    resultado.setAttribute(
      "role",
      "status"
    );

    // ======================================
    // GUARDAR CAMBIOS
    // ======================================

    botonGuardar.addEventListener(
      "click",
      async () => {
        const nuevoNombre =
          nombre.input.value.trim();

        const nuevoCelular =
          celular.input.value.trim();

        if (!nuevoNombre) {
          mostrarResultado(
            resultado,
            "El nombre es obligatorio."
          );

          return;
        }

        botonGuardar.disabled = true;

        try {
          const { error } = await supabase
            .from("perfiles")
            .update({
              nombre: nuevoNombre,
              celular: nuevoCelular || null
            })
            .eq("id", mecanico.id)
            .eq("rol", "mecanico")
            .select("id")
            .single();

          if (error) {
            throw error;
          }

          mecanico.nombre = nuevoNombre;
          mecanico.celular = nuevoCelular;

          titulo.textContent =
            "👨‍🔧 " + nuevoNombre;

          mostrarResultado(
            resultado,
            "Cambios guardados correctamente.",
            true
          );

        } catch (error) {
          console.error(
            "Error al guardar mecánico:",
            error
          );

          mostrarResultado(
            resultado,
            "Error: " +
            obtenerMensajeError(error)
          );

        } finally {
          botonGuardar.disabled = false;
        }
      }
    );

    // ======================================
    // ACTIVAR / DESACTIVAR
    // ======================================

    botonEstado.addEventListener(
      "click",
      async () => {
        const nuevoEstado = !mecanico.activo;

        const confirmado = window.confirm(
          nuevoEstado
            ? `¿Activar a ${mecanico.nombre}?`
            : `¿Desactivar a ${mecanico.nombre}?`
        );

        if (!confirmado) {
          return;
        }

        botonEstado.disabled = true;

        try {
          const { error } = await supabase
            .from("perfiles")
            .update({
              activo: nuevoEstado
            })
            .eq("id", mecanico.id)
            .eq("rol", "mecanico")
            .select("id")
            .single();

          if (error) {
            throw error;
          }

          mecanico.activo = nuevoEstado;

          estado.textContent =
            nuevoEstado
              ? "Activo"
              : "Inactivo";

          estado.className =
            "estado" +
            (nuevoEstado ? "" : " inactivo");

          botonEstado.textContent =
            nuevoEstado
              ? "Desactivar"
              : "Activar";

          mostrarResultado(
            resultado,
            "Estado actualizado correctamente.",
            true
          );

        } catch (error) {
          console.error(
            "Error al cambiar estado:",
            error
          );

          mostrarResultado(
            resultado,
            "Error: " +
            obtenerMensajeError(error)
          );

        } finally {
          botonEstado.disabled = false;
        }
      }
    );

    // ======================================
    // BOTÓN ELIMINAR
    // ======================================

    botonEliminar.addEventListener(
      "click",
      () => eliminarMecanico(
        mecanico,
        botonEliminar,
        resultado
      )
    );

    acciones.append(
      estado,
      botonGuardar,
      botonEstado,
      botonEliminar
    );

    tarjeta.append(
      titulo,
      campos,
      acciones,
      resultado
    );

    $("lista").appendChild(tarjeta);
  }
}

// ==========================================
// EVENTOS
// ==========================================

$("buscar").addEventListener(
  "input",
  mostrarMecanicos
);

$("actualizar").addEventListener(
  "click",
  cargarMecanicos
);

// ==========================================
// INICIAR
// ==========================================

verificarAcceso();
