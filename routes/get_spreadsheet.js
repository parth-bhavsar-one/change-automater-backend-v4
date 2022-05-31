const express = require("express");
const { Sequelize } = require('sequelize')
const sheetRoutes = express.Router();


sheetRoutes.route("/api/get_spreadsheet").post(async (req, res) => {

    const db = require('../conn.js');
    let query = `SELECt * FROM spreadsheets_data WHERE id = ?`;

    let data = await db.query(query, { replacements: [Number(req.body.sheet_id)], type: Sequelize.QueryTypes.SELECT })


    console.log("data: ", data)

    deliverable = data[0]
    let table_data = {
        titles: [],
        widths: [],
        types: [],
        col_config: [],
        col_data: [],
        row_ids: []
    }
    // Lets try to parse whatever value parseable and not break the code if any one is not parseable
    try { table_data.titles = JSON.parse(deliverable.columns_titles || '[]') } catch (e) { }
    try { table_data.widths = JSON.parse(deliverable.columns_widths || '[]') } catch (e) { }
    try { table_data.types = JSON.parse(deliverable.columns_types || '[]') } catch (e) { }
    try { table_data.col_config = JSON.parse(deliverable.col_config || '[]') } catch (e) { }

    table_data.row_ids = deliverable.row_ids

    for (let i = 1; i <= 50; i++) {
        try {
            table_data.col_data.push(JSON.parse(deliverable[`col_${i}`] || '[]'))
        } catch (e) { }
    }

    res.json({ data: table_data })
})

module.exports = sheetRoutes