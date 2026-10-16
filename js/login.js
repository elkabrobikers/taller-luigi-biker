
import { supabase } from "./supabase.js";

// =============================================
// TALLER LUIGI BIKER - INICIO DE SESIÓN
// =============================================

const formulario = document.getElementById("form-login");
const campoEmail = document.getElementById("email");
const campoPassword = document.getElementById("password");
const botonLogin = document.getElementById("btn-login");
const botonRecuperar = document.getElementById("btn-recuperar");
const mensaje = document.getElementById("mensaje");

// Verifica los nombres de tus archivos de panel.
// El panel de cliente ya se llama cliente-panel.html.
const RUTAS = {
  admin: "./admin.html",
  administrador: "./admin.html",
  mecanico: "./mecanico-panel.html",
  cliente: "./cliente-panel.html"
};

let procesando = false;
let recuperandoPassword = false;

function mostrarMensaje(texto, tipo = "") {
  mensaje.textContent = texto;
  mensaje.className = `mensaje ${tipo}`;
}

function bloquearFormulario(bloquear) {
  procesando = bloquear;
  botonLogin.disabled = bloquear;
  botonRecuperar.disabled = bloquear;
  botonLogin.textContent = bloquear
    ? "Procesando..."
    : "Iniciar sesión";
}

async function obtenerPerfil(usuarioId) {
  const { data, error } = await supabase
    .from("perfiles")
    .select("id,nombre,rol,activo")
    .eq("id", usuarioId)
    .single();

  if (error) {
    throw new Error(
      "No se pudo consultar tu perfil: " + error.message
    );
  }

  if (!data) {
    throw new Error(
      "Tu cuenta no tiene un perfil registrado."
    );
  }

  if (data.activo !== true) {
    throw new Error(
      "Tu cuenta está desactivada. Comunícate con el administrador."
    );
  }

  return data;
}

async function enviarAlPanel(usuario) {
  const perfil = await obtenerPerfil(usuario.id);
  const rol = String(perfil.rol || "").trim().toLowerCase();
  const ruta = RUTAS[rol];

  if (!ruta) {
    throw new Error(
      `El rol "${perfil.rol}" no tiene un panel configurado.`
    );
  }

  mostrarMensaje(
    `Bienvenido, ${perfil.nombre}. Abriendo tu panel...`,
    "exito"
  );

  window.location.replace(ruta);
}

// =============================================
// INICIAR SESIÓN
// =============================================

formulario.addEventListener("submit", async evento => {
  evento.preventDefault();

  if (procesando) return;

  const email = campoEmail.value.trim();
  const password = campoPassword.value;

  if (!email || !password) {
    mostrarMensaje(
      "Ingresa tu correo y contraseña.",
      "error"
    );
    return;
  }

  bloquearFormulario(true);
  mostrarMensaje("Verificando tu cuenta...");

  try {
    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password
      });

    if (error) {
      throw new Error(
        "Correo o contraseña incorrectos, " +
        "o la cuenta todavía no está confirmada."
      );
    }

    if (!data.user) {
      throw new Error(
        "No fue posible obtener los datos de la cuenta."
      );
    }

    await enviarAlPanel(data.user);
  } catch (error) {
    console.error("Error de acceso:", error);
    mostrarMensaje(error.message, "error");
  } finally {
    bloquearFormulario(false);
  }
});

// =============================================
// RECUPERACIÓN DE CONTRASEÑA
// =============================================

botonRecuperar.addEventListener("click", async () => {
  if (procesando) return;

  const email = campoEmail.value.trim();

  if (!email) {
    mostrarMensaje(
      "Primero escribe tu correo electrónico.",
      "error"
    );
    campoEmail.focus();
    return;
  }

  bloquearFormulario(true);

  try {
    const urlRetorno = new URL(
      "./login.html",
      window.location.href
    );

    const { error } =
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: urlRetorno.href
      });

    if (error) throw error;

    mostrarMensaje(
      "Si existe una cuenta con ese correo, " +
      "recibirás un enlace para recuperar tu contraseña.",
      "exito"
    );
  } catch (error) {
    console.error(error);
    mostrarMensaje(
      "No se pudo solicitar la recuperación: " +
      error.message,
      "error"
    );
  } finally {
    bloquearFormulario(false);
  }
});

// =============================================
// CAMBIAR CONTRASEÑA DESDE EL ENLACE DE CORREO
// =============================================

supabase.auth.onAuthStateChange((evento) => {
  if (evento === "PASSWORD_RECOVERY") {
    recuperandoPassword = true;
    mostrarFormularioRecuperacion();
  }
});

function mostrarFormularioRecuperacion() {
  const titulo = document.querySelector(".caja-login h1");
  const subtitulo = document.querySelector(".subtitulo");
  const etiquetaEmail = document.querySelector(
    'label[for="email"]'
  );

  titulo.textContent = "Nueva contraseña";
  subtitulo.textContent =
    "Escribe tu nueva contraseña para recuperar el acceso.";

  campoEmail.hidden = true;
  etiquetaEmail.hidden = true;
  campoPassword.value = "";
  campoPassword.placeholder = "Nueva contraseña";
  campoPassword.autocomplete = "new-password";

  botonLogin.textContent = "Guardar contraseña";
  botonRecuperar.hidden = true;

  // Sustituimos el formulario de acceso
  // por el formulario de nueva contraseña.
  const formularioNuevo = formulario.cloneNode(true);
  formulario.replaceWith(formularioNuevo);

  const nuevoBoton = formularioNuevo.querySelector("#btn-login");
  const nuevaPassword = formularioNuevo.querySelector("#password");
  const nuevoMensaje = formularioNuevo.querySelector("#mensaje");

  formularioNuevo.addEventListener("submit", async evento => {
    evento.preventDefault();

    if (!recuperandoPassword) return;

    const password = nuevaPassword.value;

    if (password.length < 8) {
      nuevoMensaje.textContent =
        "La contraseña debe tener al menos 8 caracteres.";
      nuevoMensaje.className = "mensaje error";
      return;
    }

    nuevoBoton.disabled = true;
    nuevoBoton.textContent = "Guardando...";

    const { error } = await supabase.auth.updateUser({
      password
    });

    if (error) {
      nuevoMensaje.textContent = error.message;
      nuevoMensaje.className = "mensaje error";
      nuevoBoton.disabled = false;
      nuevoBoton.textContent = "Guardar contraseña";
      return;
    }

    await supabase.auth.signOut();

    nuevoMensaje.textContent =
      "Contraseña actualizada. Ya puedes iniciar sesión.";
    nuevoMensaje.className = "mensaje exito";

    setTimeout(() => {
      window.location.replace("./login.html");
    }, 1800);
  });
}
