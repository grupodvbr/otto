function agoraBahia(){

return new Date(
new Date().toLocaleString("en-US",{ timeZone:"America/Bahia" })
)

}

module.exports = { agoraBahia }
