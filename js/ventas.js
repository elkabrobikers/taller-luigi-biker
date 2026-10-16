
import { supabase } from "./supabase.js";

const $ = id => document.getElementById(id);

const verificando = $("verificando");
const contenido = $("contenido");
const selectorProducto = $("producto");
const cantidad = $("cantidad");
const agregar = $("agregar");
const carritoTabla = $("carrito");
const totalElemento = $("total");
const confirmar = $("confirmar");
const mensajeVenta = $("mensaje-venta");
const historial = $("historial");
const mensajeHistorial = $("mensaje-historial");
const actualizar = $("actualizar");

let productos = [];
let carrito = [];
let autorizado = false;
let procesando = false;

function dinero(valor) {
  return "Bs. " + Number(valor).toFixed(2);
}

function mensaje(elemento, texto, color = "#ccc") {
  elemento.textContent = texto;
  elemento.style.color = color;
}

function agregarOpcion(valor, texto) {
  const opcion = document.createElement("option");
  opcion.value = String(valor);
  opcion.textContent = texto;
  selectorProducto.appendChild(opcion);
}

// VERIFICAR ADMINISTRADOR
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

    if (errorPerfil) throw errorPerfil;

    if (
      !perfil ||
      perfil.rol !== "admin" ||
      !perfil.activo
    ) {
      verificando.textContent =
        "Acceso denegado. Solo administradores.";
      return;
    }

    autorizado = true;
    verificando.hidden = true;
    contenido.hidden = false;

    await Promise.all([
      cargarProductos(),
      cargarHistorial()
    ]);

  } catch (error) {
    console.error(error);
    verificando.textContent =
      "Error al verificar acceso: " + error.message;
  }
}

// CARGAR PRODUCTOS
async function cargarProductos() {
  const { data, error } = await supabase
    .from("productos")
    .select("id, nombre, precio, stock, activo")
    .eq("activo", true)
    .gt("stock", 0)
    .order("nombre")
    .limit(1000);

  if (error) {
    mensaje(
      mensajeVenta,
      "Error al cargar productos: " + error.message,
      "#ff5252"
    );
    return;
  }

  productos = data || [];
  selectorProducto.replaceChildren();

  agregarOpcion("", "Seleccionar producto");

  for (const producto of productos) {
    agregarOpcion(
      producto.id,
      producto.nombre +
      " | " + dinero(producto.precio) +
      " | Stock: " + producto.stock
    );
  }
}

// AGREGAR PRODUCTO
agregar.addEventListener("click", () => {
  if (!autorizado || procesando) return;

  const id = Number(selectorProducto.value);
  const unidades = Number(cantidad.value);

  const producto = productos.find(
    p => Number(p.id) === id
  );

  if (!producto) {
    mensaje(
      mensajeVenta,
      "Selecciona un producto.",
      "#ff5252"
    );
    return;
  }

  if (
    !Number.isSafeInteger(unidades) ||
    unidades <= 0
  ) {
    mensaje(
      mensajeVenta,
      "Ingresa una cantidad válida.",
      "#ff5252"
    );
    return;
  }

  const existente = carrito.find(
    item => item.producto_id === id
  );

  const cantidadActual = existente
    ? existente.cantidad
    : 0;

  if (
    cantidadActual + unidades >
    producto.stock
  ) {
    mensaje(
      mensajeVenta,
      "Stock insuficiente. Disponible: " +
      producto.stock,
      "#ff5252"
    );
    return;
  }

  if (existente) {
    existente.cantidad += unidades;
  } else {
    carrito.push({
      producto_id: id,
      nombre: producto.nombre,
      precio: Number(producto.precio),
      cantidad: unidades
    });
  }

  cantidad.value = "1";
  mensaje(
    mensajeVenta,
    "Producto agregado.",
    "#00e676"
  );

  mostrarCarrito();
});

// MOSTRAR CARRITO
function mostrarCarrito() {
  carritoTabla.replaceChildren();

  if (carrito.length === 0) {
    const fila = document.createElement("tr");
    const celda = document.createElement("td");

    celda.colSpan = 5;
    celda.textContent =
      "Todavía no agregaste productos.";

    fila.appendChild(celda);
    carritoTabla.appendChild(fila);
  }

  let total = 0;

  for (const item of carrito) {
    const subtotal =
      item.precio * item.cantidad;

    total += subtotal;

    const fila = document.createElement("tr");

    for (const valor of [
      item.nombre,
      item.cantidad,
      dinero(item.precio),
      dinero(subtotal)
    ]) {
      const celda = document.createElement("td");
      celda.textContent = String(valor);
      fila.appendChild(celda);
    }

    const celdaAccion = document.createElement("td");
    const quitar = document.createElement("button");

    quitar.type = "button";
    quitar.className = "btn-quitar";
    quitar.textContent = "Quitar";
    quitar.disabled = procesando;

    quitar.addEventListener("click", () => {
      if (procesando) return;

      carrito = carrito.filter(
        p => p.producto_id !== item.producto_id
      );

      mostrarCarrito();
    });

    celdaAccion.appendChild(quitar);
    fila.appendChild(celdaAccion);
    carritoTabla.appendChild(fila);
  }

  totalElemento.textContent = dinero(total);

  confirmar.disabled =
    carrito.length === 0 ||
    procesando ||
    !autorizado;
}

// CONFIRMAR VENTA
confirmar.addEventListener("click", async () => {
  if (
    !autorizado ||
    procesando ||
    carrito.length === 0
  ) {
    return;
  }

  const aceptado = window.confirm(
    "¿Confirmar esta venta? " +
    "Se descontará el stock del inventario."
  );

  if (!aceptado) return;

  procesando = true;
  confirmar.disabled = true;
  agregar.disabled = true;
  actualizar.disabled = true;

  mensaje(
    mensajeVenta,
    "Registrando venta..."
  );

  try {
    const items = carrito.map(item => ({
      producto_id: item.producto_id,
      cantidad: item.cantidad
    }));

    const { data: ventaId, error } =
      await supabase.rpc("registrar_venta", {
        p_items: items
      });

    if (error) throw error;

    carrito = [];
    cantidad.value = "1";

    await Promise.all([
      cargarProductos(),
      cargarHistorial()
    ]);

    mensaje(
      mensajeVenta,
      "¡Venta #" + ventaId +
      " registrada correctamente! " +
      "Ya puedes descargar el comprobante.",
      "#00e676"
    );

  } catch (error) {
    console.error(error);

    mensaje(
      mensajeVenta,
      "Error al registrar venta: " +
      error.message,
      "#ff5252"
    );

  } finally {
    procesando = false;
    agregar.disabled = false;
    actualizar.disabled = false;
    mostrarCarrito();
  }
});

// GENERAR COMPROBANTE PDF
async function descargarComprobante(ventaId) {
  if (!autorizado) return;

  if (!window.jspdf?.jsPDF) {
    throw new Error(
      "No se pudo cargar la biblioteca PDF. " +
      "Revisa tu conexión a Internet."
    );
  }

  const { data: venta, error: errorVenta } =
    await supabase
      .from("ventas")
      .select("id, fecha, total, estado")
      .eq("id", ventaId)
      .single();

  if (errorVenta) throw errorVenta;

  const { data: detalles, error: errorDetalles } =
    await supabase
      .from("detalle_ventas")
      .select(
        "producto_id, cantidad, precio_unitario"
      )
      .eq("venta_id", ventaId);

  if (errorDetalles) throw errorDetalles;

  if (!detalles || detalles.length === 0) {
    throw new Error(
      "La venta no tiene productos registrados."
    );
  }

  const ids = detalles.map(d => d.producto_id);

  const { data: productosVenta, error: errorProductos } =
    await supabase
      .from("productos")
      .select("id, nombre")
      .in("id", ids);

  if (errorProductos) throw errorProductos;

  const nombres = new Map(
    (productosVenta || []).map(p => [p.id, p.nombre])
  );

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();

  const ancho = pdf.internal.pageSize.getWidth();
  let y = 20;

  // ENCABEZADO
  pdf.setFillColor(255, 107, 0);
  pdf.rect(0, 0, ancho, 9, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.setTextColor(35, 35, 35);

  pdf.text("TALLER LUIGI BIKER", ancho / 2, y, {
    align: "center"
  });

  y += 9;

  pdf.setFontSize(11);
  pdf.setFont("helvetica", "normal");
  pdf.text(
    "COMPROBANTE DE VENTA",
    ancho / 2,
    y,
    { align: "center" }
  );

  y += 15;

  pdf.setDrawColor(220, 220, 220);
  pdf.line(15, y, ancho - 15, y);

  y += 10;

  pdf.setFontSize(11);
  pdf.setTextColor(40, 40, 40);

  pdf.text("Venta Nro.: " + venta.id, 15, y);
  y += 8;

  const fecha = venta.fecha
    ? new Date(venta.fecha).toLocaleString("es-BO")
    : "Sin fecha";

  pdf.text("Fecha: " + fecha, 15, y);
  y += 8;

  pdf.text(
    "Estado: " + venta.estado.toUpperCase(),
    15,
    y
  );

  y += 15;

  // CABECERA DE TABLA
  function encabezadoTabla() {
    pdf.setFillColor(35, 35, 40);
    pdf.rect(15, y - 6, ancho - 30, 10, "F");

    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);

    pdf.text("PRODUCTO", 18, y);
    pdf.text("CANT.", 111, y);
    pdf.text("P. UNIT.", 134, y);
    pdf.text("SUBTOTAL", ancho - 18, y, {
      align: "right"
    });

    pdf.setTextColor(40, 40, 40);
    pdf.setFont("helvetica", "normal");

    y += 12;
  }

  encabezadoTabla();

  // DETALLES
  for (const detalle of detalles) {
    const nombre =
      nombres.get(detalle.producto_id) ||
      "Producto #" + detalle.producto_id;

    const lineas = pdf.splitTextToSize(
      nombre,
      83
    );

    const alto = Math.max(9, lineas.length * 5 + 3);

    if (y + alto > 265) {
      pdf.addPage();
      y = 20;
      encabezadoTabla();
    }

    pdf.setFontSize(9);
    pdf.text(lineas, 18, y);

    pdf.text(
      String(detalle.cantidad),
      112,
      y
    );

    pdf.text(
      Number(detalle.precio_unitario).toFixed(2),
      134,
      y
    );

    const subtotal =
      Number(detalle.cantidad) *
      Number(detalle.precio_unitario);

    pdf.text(
      subtotal.toFixed(2),
      ancho - 18,
      y,
      { align: "right" }
    );

    y += alto;
  }

  if (y + 40 > 275) {
    pdf.addPage();
    y = 25;
  }

  // TOTAL
  y += 6;

  pdf.setDrawColor(200, 200, 200);
  pdf.line(15, y, ancho - 15, y);

  y += 13;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.setTextColor(255, 107, 0);

  pdf.text(
    "TOTAL: Bs. " +
    Number(venta.total).toFixed(2),
    ancho - 18,
    y,
    { align: "right" }
  );

  y += 18;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(90, 90, 90);

  pdf.text(
    "Gracias por confiar en Taller Luigi Biker.",
    ancho / 2,
    y,
    { align: "center" }
  );

  pdf.save(
    "comprobante-venta-" + venta.id + ".pdf"
  );
}

// HISTORIAL DE VENTAS
async function cargarHistorial() {
  mensaje(
    mensajeHistorial,
    "Cargando ventas..."
  );

  const { data: ventas, error } =
    await supabase
      .from("ventas")
      .select("id, total, estado, fecha")
      .order("fecha", { ascending: false })
      .limit(50);

  if (error) {
    mensaje(
      mensajeHistorial,
      "Error al consultar ventas: " +
      error.message,
      "#ff5252"
    );
    return;
  }

  historial.replaceChildren();

  if (!ventas || ventas.length === 0) {
    mensaje(
      mensajeHistorial,
      "Todavía no hay ventas registradas."
    );
    return;
  }

  const ids = ventas.map(v => v.id);

  const { data: detalles, error: errorDetalles } =
    await supabase
      .from("detalle_ventas")
      .select(
        "venta_id, producto_id, cantidad, precio_unitario"
      )
      .in("venta_id", ids);

  if (errorDetalles) {
    mensaje(
      mensajeHistorial,
      "Error al consultar detalles: " +
      errorDetalles.message,
      "#ff5252"
    );
    return;
  }

  const idsProductos = [
    ...new Set(
      (detalles || []).map(d => d.producto_id)
    )
  ];

  let nombres = new Map();

  if (idsProductos.length) {
    const { data: productosVenta, error: errorProductos } =
      await supabase
        .from("productos")
        .select("id, nombre")
        .in("id", idsProductos);

    if (!errorProductos) {
      nombres = new Map(
        (productosVenta || []).map(
          p => [p.id, p.nombre]
        )
      );
    }
  }

  mensaje(
    mensajeHistorial,
    "Mostrando las 50 ventas más recientes."
  );

  for (const venta of ventas) {
    const tarjeta = document.createElement("article");
    tarjeta.className = "venta-card";

    const titulo = document.createElement("h3");
    titulo.textContent = "Venta #" + venta.id;

    const fecha = document.createElement("p");
    fecha.textContent =
      "Fecha: " +
      (venta.fecha
        ? new Date(venta.fecha)
            .toLocaleString("es-BO")
        : "Sin fecha");

    const estado = document.createElement("span");
    estado.className = "estado";
    estado.textContent =
      "Estado: " + venta.estado;

    const listaDetalles = document.createElement("ul");

    const productosDeVenta = (detalles || []).filter(
      d => d.venta_id === venta.id
    );

    for (const detalle of productosDeVenta) {
      const li = document.createElement("li");

      const nombreProducto =
        nombres.get(detalle.producto_id) ||
        "Producto #" + detalle.producto_id;

      li.textContent =
        nombreProducto +
        " × " + detalle.cantidad +
        " — " +
        dinero(
          Number(detalle.cantidad) *
          Number(detalle.precio_unitario)
        );

      listaDetalles.appendChild(li);
    }

    const total = document.createElement("p");
    const strong = document.createElement("strong");

    strong.textContent =
      "Total: " + dinero(venta.total);

    total.appendChild(strong);

    // BOTON DESCARGAR PDF
    const botonPDF = document.createElement("button");
    botonPDF.type = "button";
    botonPDF.textContent = "📄 Descargar comprobante PDF";
    botonPDF.style.marginTop = "15px";

    botonPDF.addEventListener("click", async () => {
      botonPDF.disabled = true;
      botonPDF.textContent = "Generando PDF...";

      try {
        await descargarComprobante(venta.id);

        mensaje(
          mensajeHistorial,
          "Comprobante de venta #" +
          venta.id + " generado.",
          "#00e676"
        );

      } catch (error) {
        console.error(error);

        mensaje(
          mensajeHistorial,
          "Error al generar PDF: " +
          error.message,
          "#ff5252"
        );

      } finally {
        botonPDF.disabled = false;
        botonPDF.textContent =
          "📄 Descargar comprobante PDF";
      }
    });

    tarjeta.append(
      titulo,
      fecha,
      estado,
      listaDetalles,
      total,
      botonPDF
    );

    historial.appendChild(tarjeta);
  }
}

// ACTUALIZAR
actualizar.addEventListener("click", async () => {
  if (!autorizado || procesando) return;

  actualizar.disabled = true;

  try {
    await Promise.all([
      cargarProductos(),
      cargarHistorial()
    ]);
  } finally {
    actualizar.disabled = false;
  }
});

verificarAcceso();
