
import { supabase } from "./supabase.js";

// ==========================================
// TALLER LUIGI BIKER
// REGISTRO DE MOTOCICLETAS
// ==========================================

// ELEMENTOS PRINCIPALES
const contenido = document.getElementById("contenido");
const verificando = document.getElementById("verificando");

const formulario = document.getElementById("form-moto");
const mensaje = document.getElementById("mensaje");
const guardar = document.getElementById("guardar");

// ELEMENTOS DE FOTOGRAFIA
const fotoCamara = document.getElementById("foto-camara");
const fotoArchivo = document.getElementById("foto-archivo");

const vistaFoto = document.getElementById("vista-foto");
const fotoPlaceholder = document.getElementById("foto-placeholder");
const fotoDetalles = document.getElementById("foto-detalles");
const nombreFoto = document.getElementById("nombre-foto");
const quitarFoto = document.getElementById("quitar-foto");

// VARIABLES
let fotoSeleccionada = null;
let urlTemporal = null;
let accesoAutorizado = false;

guardar.disabled = true;

// ==========================================
// MOSTRAR MENSAJES
// ==========================================
function mostrarMensaje(texto, color = "#ffffff") {
  mensaje.textContent = texto;
  mensaje.style.color = color;
}

// ==========================================
// VERIFICAR ADMINISTRADOR
// ==========================================
async function verificarAcceso() {
  try {

    const { data, error } =
      await supabase.auth.getUser();

    if (error || !data.user) {
      window.location.replace("login.html");
      return;
    }

    const { data: perfil, error: errorPerfil } =
      await supabase
        .from("perfiles")
        .select("rol, activo")
        .eq("id", data.user.id)
        .single();

    if (errorPerfil) {
      throw errorPerfil;
    }

    if (!perfil || perfil.rol !== "admin" || !perfil.activo) {
      verificando.textContent =
        "Acceso denegado. Solo administradores.";
      return;
    }

    accesoAutorizado = true;

    verificando.hidden = true;
    contenido.hidden = false;
    guardar.disabled = false;

    mostrarMensaje(
      "Formulario listo para registrar motocicletas.",
      "#00e676"
    );

  } catch (error) {
    console.error("Error de acceso:", error);

    verificando.textContent =
      "No se pudo verificar el acceso: " + error.message;
  }
}

// ==========================================
// LIMPIAR FOTOGRAFIA
// ==========================================
function limpiarFoto() {

  if (urlTemporal) {
    URL.revokeObjectURL(urlTemporal);
    urlTemporal = null;
  }

  fotoSeleccionada = null;

  fotoCamara.value = "";
  fotoArchivo.value = "";

  vistaFoto.removeAttribute("src");
  vistaFoto.hidden = true;

  fotoPlaceholder.hidden = false;
  fotoDetalles.hidden = true;

  nombreFoto.textContent = "";
}

// ==========================================
// SELECCIONAR FOTOGRAFIA
// ==========================================
function seleccionarFoto(archivo) {

  if (!archivo) {
    return;
  }

  const formatosPermitidos = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  if (!formatosPermitidos.includes(archivo.type)) {
    limpiarFoto();

    mostrarMensaje(
      "Formato no permitido. Utiliza JPG, PNG o WebP.",
      "#ff5252"
    );

    return;
  }

  if (archivo.size > 5 * 1024 * 1024) {
    limpiarFoto();

    mostrarMensaje(
      "La fotografía no debe superar los 5 MB.",
      "#ff5252"
    );

    return;
  }

  limpiarFoto();

  fotoSeleccionada = archivo;

  urlTemporal = URL.createObjectURL(archivo);

  vistaFoto.src = urlTemporal;
  vistaFoto.hidden = false;

  fotoPlaceholder.hidden = true;
  fotoDetalles.hidden = false;

  nombreFoto.textContent =
    archivo.name + " (" +
    (archivo.size / 1024 / 1024).toFixed(2) +
    " MB)";

  mostrarMensaje(
    "Fotografía seleccionada correctamente.",
    "#00e676"
  );
}

// ==========================================
// CAMARA DEL CELULAR
// ==========================================
fotoCamara.addEventListener("change", () => {
  seleccionarFoto(fotoCamara.files[0]);
});

// ==========================================
// GALERIA O ARCHIVOS
// ==========================================
fotoArchivo.addEventListener("change", () => {
  seleccionarFoto(fotoArchivo.files[0]);
});

// ==========================================
// QUITAR FOTOGRAFIA
// ==========================================
quitarFoto.addEventListener("click", () => {
  limpiarFoto();

  mostrarMensaje(
    "Fotografía quitada.",
    "#ffbd87"
  );
});

// ==========================================
// GUARDAR MOTOCICLETA
// ==========================================
formulario.addEventListener("submit", async (evento) => {

  evento.preventDefault();

  if (!accesoAutorizado) {
    mostrarMensaje(
      "No tienes permisos para registrar motocicletas.",
      "#ff5252"
    );
    return;
  }

  // OBTENER DATOS
  const placa = document.getElementById("placa")
    .value.trim().toUpperCase();

  const marca = document.getElementById("marca")
    .value.trim();

  const modelo = document.getElementById("modelo")
    .value.trim();

  const color = document.getElementById("color")
    .value.trim();

  const propietario = document.getElementById("propietario")
    .value.trim();

  const celular = document.getElementById("celular")
    .value.trim();

  const observaciones =
    document.getElementById("observaciones")
      .value.trim();

  // VALIDAR CAMPOS
  if (!placa || !marca || !propietario || !celular) {
    mostrarMensaje(
      "Completa los campos obligatorios.",
      "#ff5252"
    );
    return;
  }

  guardar.disabled = true;
  guardar.textContent = "Guardando motocicleta...";

  let rutaFoto = null;

  try {

    // ======================================
    // 1. COMPROBAR PLACA EXISTENTE
    // ======================================
    const { data: motoExistente, error: errorConsulta } =
      await supabase
        .from("motocicletas")
        .select("id")
        .eq("placa", placa)
        .limit(1);

    if (errorConsulta) {
      throw errorConsulta;
    }

    if (motoExistente && motoExistente.length > 0) {
      throw new Error(
        "Ya existe una motocicleta con esta placa."
      );
    }

    // ======================================
    // 2. SUBIR FOTOGRAFIA SI EXISTE
    // ======================================
    if (fotoSeleccionada) {

      mostrarMensaje(
        "Subiendo fotografía...",
        "#ffffff"
      );

      const extensiones = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp"
      };

      const extension =
        extensiones[fotoSeleccionada.type];

      const identificador =
        crypto.randomUUID();

      rutaFoto =
        "motocicletas/" +
        identificador +
        "." +
        extension;

      const { error: errorFoto } =
        await supabase.storage
          .from("fotos-motos")
          .upload(
            rutaFoto,
            fotoSeleccionada,
            {
              contentType: fotoSeleccionada.type,
              upsert: false
            }
          );

      if (errorFoto) {
        throw errorFoto;
      }
    }

    // ======================================
    // 3. GUARDAR DATOS EN SUPABASE
    // ======================================
    mostrarMensaje(
      "Registrando motocicleta...",
      "#ffffff"
    );

    const nuevaMoto = {
      placa: placa,
      nombre_propietario: propietario,
      celular_propietario: celular,
      marca: marca || null,
      modelo: modelo || null,
      color: color || null,
      observaciones: observaciones || null,
      foto_url: rutaFoto
    };

    const { data: motoGuardada, error: errorGuardar } =
      await supabase
        .from("motocicletas")
        .insert(nuevaMoto)
        .select("id, placa")
        .single();

    if (errorGuardar) {
      throw errorGuardar;
    }

    // ======================================
    // 4. MOSTRAR CONFIRMACION
    // ======================================
    console.log(
      "Motocicleta registrada:",
      motoGuardada
    );

    mostrarMensaje(
      "¡Motocicleta registrada correctamente! " +
      "Placa: " + motoGuardada.placa +
      " | Registro N.º " + motoGuardada.id,
      "#00e676"
    );

    // LIMPIAR FORMULARIO
    formulario.reset();
    limpiarFoto();

  } catch (error) {

    console.error(
      "Error al registrar motocicleta:",
      error
    );

    // SI LA INSERCION FALLA, INTENTAR
    // ELIMINAR LA FOTO RECIEN SUBIDA.
    if (rutaFoto) {

      const { error: errorLimpieza } =
        await supabase.storage
          .from("fotos-motos")
          .remove([rutaFoto]);

      if (errorLimpieza) {
        console.error(
          "No se pudo limpiar la foto:",
          errorLimpieza
        );
      }
    }

    mostrarMensaje(
      "No se pudo registrar: " + error.message,
      "#ff5252"
    );

  } finally {

    guardar.disabled = false;
    guardar.textContent = "Guardar motocicleta";

  }
});

// ==========================================
// INICIAR SISTEMA
// ==========================================
verificarAcceso();
