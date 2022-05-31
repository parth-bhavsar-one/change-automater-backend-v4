function(properties, context) {

    const { Sequelize } = require('sequelize')
    const db = new Sequelize(context.keys['PostgreSQL Connection URL'])
    // let config = JSON.parse(properties.config)
    let res = {
        data: '',
    }

    let content = context.async(async (callback) => {

        let query = `SELECt * FROM spreadsheets_data WHERE id IN (SELECT cr_spreadsheet FROM change_approach WHERE id = ${properties.id})`;

        db.query(query)
            .then(async (data) => {

                let risks = await db.query(`SELECT id, change_risks FROM change_canvas WHERE id = ${properties.change_canvas}`)

                function parseSpreadSheetData(record) {
                    let table_data = { col_data: [] }
                    // Let's try to parse as much cols as possible and prevent and invalid json break the code
                    try { table_data.titles = JSON.parse(record.columns_titles || '[]') } catch (e) { }
                    try { table_data.widths = JSON.parse(record.columns_widths || '[]') } catch (e) { }
                    try { table_data.types = JSON.parse(record.columns_types || '[]') } catch (e) { }
                    try { table_data.col_config = JSON.parse(record.col_config || '[]') } catch (e) { }
                    for (let i = 1; i <= 50; i++) {
                        // Try to parse the column to prevent error stoping the code.
                        let col = [];
                        try { col = JSON.parse(record['col_' + i] || '[]') } catch (e) { }
                        table_data.col_data.push(col)
                    }
                    return table_data;
                }
                let deliverable = parseSpreadSheetData((data[0][0] || {}))

                let query = `UPDATE spreadsheets_data SET col_config = ? , columns_titles = ? , columns_widths = ? , columns_types = ? `
                let updatedData = JSON.parse(properties.data)
                let cols = [];

                if (Array.isArray(updatedData.col_data)) {
                    updatedData.col_data.forEach((col, index) => {
                        query += `, col_${index + 1} = ? `
                    })
                    cols = updatedData.col_data.map(col => JSON.stringify(col))
                }
                query += ` WHERE id IN ( SELECT cr_spreadsheet FROM change_approach WHERE id = ${properties.id}) RETURNING *`

                let updatedDeliverable = await db.query(query, {
                    type: Sequelize.QueryTypes.UPDATE,
                    replacements: [JSON.stringify(updatedData.col_config), JSON.stringify(updatedData.titles), JSON.stringify(updatedData.widths), JSON.stringify(updatedData.types), ...cols],
                })


                query = `UPDATE change_canvas SET change_risks = ?`
                let updatedRisks = ''
                updatedData.col_config.forEach((config, index) => {
                    if (config.orignal_title == 'risk') {
                        updatedRisks = `${updatedData.col_data[index].join('\n')}`
                        // deliverable.col_data[index] = ((risks[0][0] && risks[0][0].change_risks) || '').split('\n')
                    }
                })
                if (updatedRisks && updatedRisks.length > 0) {
                    query += `${updatedRisks} WHERE id = ${properties.change_canvas}`
                    let updatedSM = await db.query(query, {
                        type: Sequelize.QueryTypes.UPDATE,
                        replacements: [updatedRisks],
                    })
                }

                res.data = properties.data
                callback(null, res)

            })
            .catch(e => {
                res.data = JSON.stringify(e)
                callback(null, res)
            })
    })

    return content
}