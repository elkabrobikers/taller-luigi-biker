
import { supabase } from "./supabase.js";
import { prepararRegistro } from "./registro-usuarios.js";

// TALLER LUIGI BIKER
// GESTIÓN COMPLETA DE CLIENTES

// Nombre real de la función según la URL de Supabase
const FUNCION_ELIMINAR = "rapid-api";

const $ = (id) => document.getElementById(id);

let clientes = [];
let motos = [];
let motoSeleccionada = null;
let trabajando = false;
let autorizado = false;

function mensaje(texto, color = "") {
  const elemento = $("mensaje");
  if (!elemento) return;
  elemento.textContent = texto;
  elemento.style.color = color;
}

function crear(tipo, texto = "", clase = "") {
  const elemento = document.createElement(tipo);
  elemento.textContent = String(texto ?? "");
  elemento.className = clase;
  return elemento;
}

function clientePorId(id) {
  return clientes.find((c) => c.id === id);
}

function nombreCliente(id) {
  if (!id) return "Sin cuenta vinculada";
  return clientePorId(id)?.nombre || "Cuenta no encontrada";
}

function motosDelCliente(id) {
  return motos.filter((m) => m.propietario_id === id);
}

// ==========================================
// VERIFICAR ADMINISTRADOR
// ==========================================

async function verificarAcceso() {
  try {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
      location.replace("./login.html");
      return;
    }

    const { data: perfil, error: errorPerfil } =
      await supabase
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
      throw new Error(
        "Acceso exclusivo para administradores activos."
      );
    }

    autorizado = true;

    await cargarDatos();

    // Conserva tu registro de clientes.
    prepararRegistro({
      formularioId: "form-registro",
      mensajeId: "mensaje-registro",
      botonId: "crear-cuenta",
      rol: "cliente",
      alCrear: cargarDatos
    });

    $("cargando").hidden = true;
    $("app").hidden = false;

  } catch (error) {
    console.error(error);
    $("cargando").textContent =
      "Error al verificar acceso: " + error.message;
  }
}

// ==========================================
// CARGAR CLIENTES Y MOTOS
// ==========================================

async function cargarDatos() {
  if (!autorizado) return;

  const [respuestaClientes, respuestaMotos] =
    await Promise.all([
      supabase
        .from("perfiles")
        .select("id,nombre,celular,rol,activo")
        .eq("rol", "cliente")
        .order("nombre"),

      supabase
        .from("motocicletas")
        .select(
          "id,placa,marca,modelo,nombre_propietario," +
          "celular_propietario,propietario_id"
        )
        .order("id", { ascending: false })
    ]);

  if (respuestaClientes.error) {
    throw respuestaClientes.error;
  }

  if (respuestaMotos.error) {
    throw respuestaMotos.error;
  }

  clientes = respuestaClientes.data || [];
  motos = respuestaMotos.data || [];

  dibujarClientes();
  dibujarMotos();
  dibujarListaClientes();

  if (motoSeleccionada) {
    motoSeleccionada =
      motos.find(
        (m) => m.id === motoSeleccionada.id
      ) || null;

    dibujarResultado();
  }
}

// ==========================================
// TARJETAS DE CLIENTES
// ==========================================

function dibujarListaClientes() {
  const destino = $("lista-clientes");
  if (!destino) return;

  const filtro = $("buscar-lista-clientes")
    .value.trim().toLowerCase();

  const encontrados = clientes.filter((c) =>
    `${c.nombre || ""} ${c.celular || ""}`
      .toLowerCase()
      .includes(filtro)
  );

  destino.replaceChildren();

  $("mensaje-lista-clientes").textContent =
    `Mostrando ${encontrados.length} cliente(s).`;

  if (!encontrados.length) {
    destino.appendChild(
      crear("p", "No se encontraron clientes.")
    );
    return;
  }

  for (const cliente of encontrados) {
    const tarjeta = crear(
      "article", "", "cliente-card"
    );

    const titulo = crear(
      "h3",
      "👤 " + (cliente.nombre || "Sin nombre")
    );

    const celular = crear(
      "p",
      "📱 Celular: " +
      (cliente.celular || "No registrado")
    );

    const estado = crear(
      "span",
      cliente.activo ? "Activo" : "Inactivo",
      cliente.activo
        ? "cliente-estado"
        : "cliente-estado inactivo"
    );

    const cantidad = crear(
      "p",
      "🏍️ Motocicletas vinculadas: " +
      motosDelCliente(cliente.id).length
    );

    const botonEliminar = crear(
      "button",
      "🗑️ Eliminar cliente",
      "btn-eliminar-cliente"
    );

    botonEliminar.type = "button";

    const resultado = crear(
      "p", "", "resultado-eliminar"
    );

    resultado.setAttribute("role", "status");

    botonEliminar.addEventListener(
      "click",
      () => eliminarCliente(
        cliente,
        botonEliminar,
        resultado
      )
    );

    tarjeta.append(
      titulo,
      celular,
      estado,
      cantidad,
      botonEliminar,
      resultado
    );

    destino.appendChild(tarjeta);
  }
}

// ==========================================
// LEER ERRORES DE EDGE FUNCTION
// ==========================================

async function detalleErrorFuncion(error) {
  let texto = error?.message ||
    "Error desconocido.";

  if (error?.context instanceof Response) {
    const respuesta = error.context;

    try {
      const cuerpo = await respuesta.clone().json();

      texto = cuerpo?.error ||
        cuerpo?.message ||
        texto;
    } catch {
      // Conservar mensaje original.
    }

    return `HTTP ${respuesta.status}: ${texto}`;
  }

  return texto;
}

// ==========================================
// ELIMINAR CLIENTE
// SOLO UNA CONFIRMACIÓN
// ==========================================

async function eliminarCliente(
  cliente,
  boton,
  resultado
) {
  if (!autorizado || trabajando) return;

  const vinculadas = motosDelCliente(cliente.id);

  if (vinculadas.length > 0) {
    resultado.textContent =
      `No se puede eliminar a ${cliente.nombre}: ` +
      `tiene ${vinculadas.length} motocicleta(s) ` +
      "vinculada(s).";

    resultado.style.color = "#ff8585";
    return;
  }

  // UNA SOLA CONFIRMACIÓN.
  // YA NO SE PIDE ESCRIBIR "ELIMINAR".
  const confirmado = window.confirm(
    `¿Seguro que deseas eliminar a ${cliente.nombre}?\n\n` +
    "Se eliminará su cuenta de acceso.\n" +
    "Esta acción no se puede deshacer."
  );

  if (!confirmado) {
    resultado.textContent = "Eliminación cancelada.";
    resultado.style.color = "#cccccc";
    return;
  }

  trabajando = true;
  boton.disabled = true;
  boton.textContent = "Eliminando...";

  resultado.textContent =
    "Solicitando eliminación a Supabase...";

  resultado.style.color = "#cccccc";

  try {
    const { data: sesion, error: errorSesion } =
      await supabase.auth.getSession();

    if (
      errorSesion ||
      !sesion?.session?.access_token
    ) {
      throw new Error(
        "Sesión caducada. Inicia sesión nuevamente."
      );
    }

    const { data, error } =
      await supabase.functions.invoke(
        FUNCION_ELIMINAR,
        {
          body: {
            tipo: "cliente",
            id: cliente.id
          }
        }
      );

    if (error) {
      throw new Error(
        await detalleErrorFuncion(error)
      );
    }

    if (!data?.ok) {
      throw new Error(
        data?.error ||
        "Supabase no confirmó la eliminación."
      );
    }

    await cargarDatos();

    $("mensaje-lista-clientes").textContent =
      `Cliente ${cliente.nombre} eliminado correctamente.`;

    $("mensaje-lista-clientes").style.color =
      "#69e4a2";

  } catch (error) {
    console.error(
      "Error al eliminar cliente:",
      error
    );

    resultado.textContent =
      "No se pudo eliminar: " + error.message;

    resultado.style.color = "#ff8585";

  } finally {
    trabajando = false;
    boton.disabled = false;
    boton.textContent = "🗑️ Eliminar cliente";
  }
}

// ==========================================
// SELECTOR DE CLIENTES
// ==========================================

function dibujarClientes() {
  const selector = $("cliente");
  const seleccionado = selector.value;

  const filtro = $("buscar-cliente")
    .value.trim().toLowerCase();

  selector.replaceChildren(
    new Option("Selecciona un cliente", "")
  );

  const filtrados = clientes.filter((c) =>
    `${c.nombre || ""} ${c.celular || ""}`
      .toLowerCase()
      .includes(filtro)
  );

  for (const cliente of filtrados) {
    selector.add(
      new Option(
        `${cliente.nombre} - ` +
        `${cliente.celular || "Sin celular"}` +
        (cliente.activo ? "" : " (inactivo)"),
        cliente.id
      )
    );
  }

  if (
    filtrados.some(
      (c) => c.id === seleccionado
    )
  ) {
    selector.value = seleccionado;
  }

  dibujarClienteSeleccionado();
}

function dibujarClienteSeleccionado() {
  const cliente = clientePorId(
    $("cliente").value
  );

  const destino = $("datos-cliente");

  destino.replaceChildren();
  destino.hidden = !cliente;

  if (!cliente) return;

  destino.append(
    crear("strong", cliente.nombre),
    crear(
      "p",
      "Celular: " +
      (cliente.celular || "Sin registrar")
    ),
    crear(
      "p",
      "Estado: " +
      (cliente.activo ? "Activo" : "Inactivo")
    )
  );
}

$("buscar-cliente").addEventListener(
  "input",
  dibujarClientes
);

$("cliente").addEventListener("change", () => {
  dibujarClienteSeleccionado();
  dibujarResultado();
});

// ==========================================
// BUSCAR MOTOCICLETA
// ==========================================

$("form-buscar-moto").addEventListener(
  "submit",
  (evento) => {
    evento.preventDefault();

    const placa = $("placa")
      .value.trim().toUpperCase();

    motoSeleccionada = motos.find((m) =>
      String(m.placa || "")
        .trim().toUpperCase() === placa
    ) || null;

    dibujarResultado();

    mensaje(
      motoSeleccionada
        ? ""
        : "No se encontró esa motocicleta."
    );
  }
);

// ==========================================
// MOSTRAR MOTOCICLETA
// ==========================================

function dibujarResultado() {
  const destino = $("resultado-moto");
  destino.replaceChildren();

  if (!motoSeleccionada) return;

  const moto = motoSeleccionada;
  const cliente = clientePorId(
    $("cliente").value
  );

  const bloque = crear(
    "div", "", "resultado"
  );

  bloque.append(
    crear("h3", "🏍️ " + moto.placa),
    crear(
      "p",
      `Motocicleta: ${moto.marca || ""} ` +
      `${moto.modelo || ""}`
    ),
    crear(
      "p",
      "Propietario registrado: " +
      (moto.nombre_propietario || "Sin registrar")
    ),
    crear(
      "p",
      "Celular: " +
      (moto.celular_propietario || "Sin registrar")
    ),
    crear(
      "p",
      "Cuenta vinculada: " +
      nombreCliente(moto.propietario_id)
    )
  );

  const acciones = crear(
    "div", "", "acciones"
  );

  if (!moto.propietario_id) {
    const vincular = crear(
      "button",
      "✓ Vincular motocicleta"
    );

    vincular.type = "button";
    vincular.disabled =
      !cliente || !cliente.activo;

    vincular.addEventListener(
      "click",
      vincularMoto
    );

    acciones.appendChild(vincular);

  } else {
    const desvincular = crear(
      "button",
      "Desvincular motocicleta",
      "btn-peligro"
    );

    desvincular.type = "button";

    desvincular.addEventListener(
      "click",
      desvincularMoto
    );

    acciones.appendChild(desvincular);
  }

  bloque.appendChild(acciones);
  destino.appendChild(bloque);
}

// ==========================================
// VINCULAR MOTOCICLETA
// ==========================================

async function vincularMoto() {
  if (trabajando || !motoSeleccionada) return;

  const cliente = clientePorId(
    $("cliente").value
  );

  if (!cliente || !cliente.activo) {
    mensaje("Selecciona un cliente activo.");
    return;
  }

  const moto = motoSeleccionada;

  const confirmado = window.confirm(
    `¿Confirmas que la moto ${moto.placa} ` +
    `pertenece a ${cliente.nombre}?\n\n` +
    "Propietario registrado: " +
    `${moto.nombre_propietario || "Sin registrar"}\n` +
    "Verifica su identidad antes de continuar."
  );

  if (!confirmado) return;

  trabajando = true;

  try {
    const { data, error } = await supabase
      .from("motocicletas")
      .update({
        propietario_id: cliente.id
      })
      .eq("id", moto.id)
      .is("propietario_id", null)
      .select("id");

    if (error) throw error;

    if (!data?.length) {
      throw new Error(
        "La motocicleta ya fue vinculada. " +
        "Actualiza los datos."
      );
    }

    await cargarDatos();

    mensaje(
      `Moto ${moto.placa} vinculada a ${cliente.nombre}.`,
      "#69e4a2"
    );

  } catch (error) {
    console.error(error);

    mensaje(
      "Error al vincular: " + error.message,
      "#ff8585"
    );

  } finally {
    trabajando = false;
  }
}

// ==========================================
// DESVINCULAR MOTOCICLETA
// ==========================================

async function desvincularMoto() {
  if (trabajando || !motoSeleccionada) return;

  const moto = motoSeleccionada;

  if (!moto.propietario_id) return;

  const confirmado = window.confirm(
    `¿Desvincular la moto ${moto.placa}?\n\n` +
    "El cliente dejará de verla en su panel."
  );

  if (!confirmado) return;

  trabajando = true;

  try {
    const { data, error } = await supabase
      .from("motocicletas")
      .update({
        propietario_id: null
      })
      .eq("id", moto.id)
      .eq(
        "propietario_id",
        moto.propietario_id
      )
      .select("id");

    if (error) throw error;

    if (!data?.length) {
      throw new Error(
        "La vinculación cambió. Actualiza el listado."
      );
    }

    await cargarDatos();

    mensaje(
      `Moto ${moto.placa} desvinculada.`,
      "#69e4a2"
    );

  } catch (error) {
    console.error(error);

    mensaje(
      "Error al desvincular: " + error.message,
      "#ff8585"
    );

  } finally {
    trabajando = false;
  }
}

// ==========================================
// TABLA DE MOTOCICLETAS
// ==========================================

function dibujarMotos() {
  const tabla = $("tabla-motos");
  tabla.replaceChildren();

  if (!motos.length) {
    const fila = document.createElement("tr");

    const celda = crear(
      "td",
      "No hay motocicletas registradas."
    );

    celda.colSpan = 4;

    fila.appendChild(celda);
    tabla.appendChild(fila);

    return;
  }

  for (const moto of motos) {
    const fila = document.createElement("tr");

    [
      moto.placa,
      `${moto.marca || ""} ${moto.modelo || ""}`,
      moto.nombre_propietario,
      nombreCliente(moto.propietario_id)
    ].forEach((valor) => {
      fila.appendChild(
        crear("td", valor || "No registrado")
      );
    });

    tabla.appendChild(fila);
  }
}

// ==========================================
// ACTUALIZAR
// ==========================================

$("actualizar").addEventListener(
  "click",
  async () => {
    try {
      await cargarDatos();
      mensaje("Listado actualizado.");
    } catch (error) {
      mensaje(
        "Error: " + error.message,
        "#ff8585"
      );
    }
  }
);

$("actualizar-clientes").addEventListener(
  "click",
  async () => {
    const boton = $("actualizar-clientes");
    boton.disabled = true;

    try {
      await cargarDatos();

      $("mensaje-lista-clientes").textContent =
        "Clientes actualizados.";

    } catch (error) {
      $("mensaje-lista-clientes").textContent =
        "Error: " + error.message;

    } finally {
      boton.disabled = false;
    }
  }
);

$("buscar-lista-clientes").addEventListener(
  "input",
  dibujarListaClientes
);

// ==========================================
// CERRAR SESIÓN
// ==========================================

$("salir").addEventListener(
  "click",
  async () => {
    const { error } =
      await supabase.auth.signOut();

    if (error) {
      mensaje(
        "Error al cerrar sesión: " +
        error.message
      );
      return;
    }

    location.replace("./login.html");
  }
);

// ==========================================
// INICIAR
// ==========================================

verificarAcceso();
