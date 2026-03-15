const supabase = require("../utils/supabase")

async function criarReserva(reserva,telefone){

const datahora = reserva.data + "T" + reserva.hora

await supabase
.from("reservas_mercatto")
.insert({

nome:reserva.nome,
telefone:telefone,
pessoas:parseInt(reserva.pessoas) || 1,
mesa:reserva.area || "Salão",
datahora:datahora,
status:"Pendente"

})

}

module.exports = { criarReserva }
