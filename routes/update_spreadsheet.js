const express = require("express");
const { Sequelize } = require('sequelize')
const sheetRoutes = express.Router();


sheetRoutes.route("/api/update_spreadsheet").post( async (req, res) => {

    const db = require('../conn.js');
    let query = `UPDATE spreadsheets_data set columns_titles = ?, columns_widths = ?, columns_types = ?, col_config = ?, row_ids = ?, `

        let data;
        try{
            data = JSON.parse(req.body.sheet_data)
        }catch(e){
            console.log(e, req.body)
            res.json({ 'error': 'Invalid JSON body', body: req.body.sheet_data, e })
            return
        }
        let cols = [];
        (data.col_data || []).forEach((col, index) => {
            cols.push( JSON.stringify(col || []) )
            query += `col_${index+1} = ?, `
        })
        query = query.slice(0, -2) + ` WHERE id = ?`;

        await db.query(query,  {
            type: Sequelize.QueryTypes.UPDATE,
            replacements: [JSON.stringify(data.titles || []), JSON.stringify(data.widths || []), JSON.stringify(data.types || []), JSON.stringify(data.col_config || []), JSON.stringify(data.row_ids), ...cols, Number(req.body.sheet_id)],
        })
        res.json({data:  req.body.sheet_data})
})

module.exports = sheetRoutes