
import { supabase } from "./supabase.js";

// Registro seguro mediante Supabase Edge Function.
// Nunca colocar la service_role key en este archivo.

export function prepararRegistro({
  formularioId,
  mensajeId,
  botonId,
  rol,
  alCrear
}) {
  const form = document.getElementById(formularioId);
  const mensaje = document.getElementById(mensajeId);
  const boton = document.getElementById(botonId);

  if (!form || !mensaje || !boton) return;

  let procesando = false;

  form.addEventListener("submit", async evento => {
    evento.preventDefault();

    if (procesando) return;

    const valor = (nombre) =>
      form.querySelector(`[name="${nombre}"]`)?.value.trim() || "";

    const nombre = valor("nombre") ||
      document.getElementById("nuevo-nombre")?.value.trim() || "";

    const usuario = valor("usuario") ||
      document.getElementById("nuevo-usuario")?.value.trim() || "";

    const email = valor("email") ||
      document.getElementById("nuevo-email")?.value.trim() || "";

    const celular = valor("celular") ||
      document.getElementById("nuevo-celular")?.value.trim() || "";

    const password = form.querySelector('[name="password"]')?.value ||
      document.getElementById("nueva-clave")?.value || "";

    const confirmar = form.querySelector('[name="confirmar"]')?.value ||
      document.getElementById("confirmar-clave")?.value || "";

    if (!nombre || !email) {
      mensaje.textContent = "Completa el nombre y el correo.";
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,30}$/.test(usuario)) {
      mensaje.textContent =
        "El usuario debe tener entre 3 y 30 letras, números o guiones bajos.";
      return;
    }

    if (password.length < 8) {
      mensaje.textContent =
        "La contraseña debe tener al menos 8 caracteres.";
      return;
    }

    if (password !== confirmar) {
      mensaje.textContent = "Las contraseñas no coinciden.";
      return;
    }

    procesando = true;
    boton.disabled = true;
    mensaje.style.color = "#cccccc";
    mensaje.textContent = "Creando cuenta...";

    try {
      
const { data, error } = await supabase.functions.invoke(
  "dynamic-api",
  {
    body: {
      nombre,
      usuario,
      email,
      celular,
      password,
      rol
    }
  }
);


      if (error) {
        let detalle = error.message;

        try {
          const respuesta = await error.context?.json();
          detalle = respuesta?.error || detalle;
        } catch (_) {}

        throw new Error(detalle);
      }

      if (!data?.ok) {
        throw new Error(
          data?.error || "No se pudo crear la cuenta."
        );
      }

      mensaje.style.color = "#69e4a2";
      mensaje.textContent =
        `Cuenta creada correctamente para ${nombre}. ` +
        `Podrá iniciar sesión con ${email}.`;

      form.reset();

      if (typeof alCrear === "function") {
        await alCrear();
      }

    } catch (error) {
      console.error(error);

      mensaje.style.color = "#ff7a7a";
      mensaje.textContent =
        "Error al crear cuenta: " + error.message;

    } finally {
      procesando = false;
      boton.disabled = false;
    }
  });
}
