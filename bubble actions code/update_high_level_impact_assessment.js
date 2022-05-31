function(properties, context) {

    const { Sequelize } = require('sequelize')
    const db = new Sequelize(context.keys['PostgreSQL Connection URL'])

    let res = {
        data: '',
    }

    let content = context.async(async (callback) => {

        let query = `SELECt * FROM spreadsheets_data WHERE id IN (SELECT hli_table_connection FROM high_level_impact_assesment WHERE id = ${properties.id})`;
        db.query(query)
            .then(async (data) => {

                let sm = await db.query(`SELECt * FROM spreadsheets_data WHERE id IN (SELECT sm_table_connection FROM stakeholder_matrix WHERE id = ${properties.stakeholder_matrix})`)

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
                sm = parseSpreadSheetData((sm[0][0] || {}))

                let query = `UPDATE spreadsheets_data SET col_config = ? , columns_titles = ? , columns_widths = ? , columns_types = ? `
                let updatedData = JSON.parse(properties.data)

                if (Array.isArray(updatedData.col_data)) {
                    updatedData.col_data.forEach((col, index) => {
                        query += `, col_${index + 1} = ? `
                    })
                }
                let cols = (updatedData.col_data || []).map(col => JSON.stringify(col))
                query += ` WHERE id IN ( SELECT hli_table_connection FROM high_level_impact_assesment WHERE id = ${properties.id} ) RETURNING *`

                let updatedDeliverable = await db.query(query, {
                    type: Sequelize.QueryTypes.UPDATE,
                    replacements: [JSON.stringify(updatedData.col_config), JSON.stringify(updatedData.titles), JSON.stringify(updatedData.widths), JSON.stringify(updatedData.types), ...cols],
                })

                // Update the data in Stakeholder Matrix as well
                query = `UPDATE spreadsheets_data SET `
                cols = []
                let fieldsToUpdate = ''
                // Columns to be updated also in stakeholder matrix
                updatedData.col_config.forEach((d_config, d_index) => {
                    d_config = d_config || {}
                    if (["stakeholdergroup"].includes(d_config.orignal_title)) {
                        // These columns need to be updated in the sm spreadsheet as well
                        sm.col_config.forEach((sm_config, sm_index) => {
                            if (d_config.src_col_title == sm_config.orignal_title) {
                                fieldsToUpdate += `, col_${sm_index + 1} = ? `
                                cols.push(JSON.stringify(updatedData.col_data[d_index]))
                                // sm.col_data[sm_index] = updatedData.col_data[d_index]
                            }
                        })
                    }
                })
                // If the relevent data is actually changed in stakeholder matrix, save it as well
                if (fieldsToUpdate && fieldsToUpdate.length > 0) {
                    query += fieldsToUpdate.substring(1)
                    query += ` WHERE id IN ( SELECT sm_table_connection FROM stakeholder_matrix WHERE id = ${properties.stakeholder_matrix} ) RETURNING *`
                    let updatedSM = await db.query(query, {
                        type: Sequelize.QueryTypes.UPDATE,
                        replacements: [...cols],
                    })
                }

                res.data = properties.data
                callback(null, res)
            })
            .catch(e => {
                callback(e, null)
            })
    })

    return content
}