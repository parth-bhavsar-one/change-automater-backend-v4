const { Sequelize } = require('sequelize')
const DB = new Sequelize( process.env.PG_URL )

module.exports = DB;