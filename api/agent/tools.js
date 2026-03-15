const agenda = require("../services/agenda")
const pedidos = require("../services/pedidos")
const cardapio = require("../services/cardapio")

const tools = {

buscarAgendaDoDia: agenda.buscarAgendaDoDia,

calcularCouvert: agenda.calcularCouvert,

buscarCardapio: cardapio.buscarCardapio,

salvarPedidoPendente: pedidos.salvarPedidoPendente,

confirmarPedido: pedidos.confirmarPedido

}

module.exports = tools
