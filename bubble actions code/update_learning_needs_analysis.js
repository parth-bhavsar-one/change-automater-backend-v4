function(properties, context) {

    const { Sequelize } = require('sequelize')
    const db = new Sequelize(context.keys['PostgreSQL Connection URL'])

    let res = {
        data: '',
    }

    let content = context.async(async (callback) => {

        let query = `SELECt * FROM spreadsheets_data WHERE id IN (SELECT lna_table_connection FROM learning_needs_analysis WHERE id = ${properties.id})`;
        db.query(query)
            .then(async (data) => {

                let dia = await db.query(`SELECt * FROM spreadsheets_data WHERE id IN (SELECT dia_table_connection FROM detailed_impact_assessment WHERE id = ${properties.detailed_impact_assessment})`)
                // Roles Impacted column is fetched from the Stakeholder Matrix Stakeholder SubGroup
                // So Fetching the Stakeholder Impacts spreadsheet instead to extract the column value
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
                dia = parseSpreadSheetData((dia[0][0] || {}))

                let query = `UPDATE spreadsheets_data SET col_config = ? , columns_titles = ? , columns_widths = ? , columns_types = ? `
                let updatedData = JSON.parse(properties.data)
                let cols = [];

                if (Array.isArray(updatedData.col_data)) {
                    updatedData.col_data.forEach((col, index) => {
                        query += `, col_${index + 1} = ? `
                    })
                    cols = updatedData.col_data.map(col => JSON.stringify(col))
                }
                query += ` WHERE id IN ( SELECT lna_table_connection FROM learning_needs_analysis WHERE id = ${properties.id} ) RETURNING *`

                let updatedDeliverable = await db.query(query, {
                    type: Sequelize.QueryTypes.UPDATE,
                    replacements: [JSON.stringify(updatedData.col_config), JSON.stringify(updatedData.titles), JSON.stringify(updatedData.widths), JSON.stringify(updatedData.types), ...cols],
                })

                // Update the data in Stakeholder Matrix as well
                let query1 = `UPDATE spreadsheets_data SET `
                let query2 = `UPDATE spreadsheets_data SET `
                let cols1 = []
                let cols2 = []
                let fieldsToUpdate1 = ''
                let fieldsToUpdate2 = ''

                // Columns to be updated also in stakeholder matrix
                updatedData.col_config.forEach((d_config, d_index) => {
                    d_config = d_config || {}

                    if (["whatprocesswillchange", "asisdescription", "tobedescription"].includes(d_config.orignal_title)) {
                        // These columns need to be updated in the dia spreadsheet
                        dia.col_config.forEach((dia_config, dia_index) => {
                            if (d_config.src_col_title == dia_config.orignal_title) {
                                fieldsToUpdate1 += `, col_${dia_index + 1} = ? `
                                cols1.push(JSON.stringify(updatedData.col_data[d_index]))
                            }
                        })
                    }
                    if (["stakeholderroleswiththislearning"].includes(d_config.orignal_title)) {
                        // These columns need to be populated from the sm spreadsheet
                        sm.col_config.forEach((sm_config, sm_index) => {
                            if (d_config.src_col_title == sm_config.orignal_title) {
                                fieldsToUpdate2 += `, col_${sm_index + 1} = ? `
                                cols2.push(JSON.stringify(updatedData.col_data[d_index]))
                            }
                        })
                    }
                })

                if (fieldsToUpdate1 && fieldsToUpdate1.length > 0) {
                    query1 += fieldsToUpdate1.substring(1)
                    query1 += ` WHERE id IN ( SELECT dia_table_connection FROM detailed_impact_assessment WHERE id = ${properties.detailed_impact_assessment} ) RETURNING *`
                    let updatedSM = await db.query(query1, {
                        type: Sequelize.QueryTypes.UPDATE,
                        replacements: cols1,
                    })
                }
                if (fieldsToUpdate2 && fieldsToUpdate2.length > 0) {
                    query2 += fieldsToUpdate2.substring(1)
                    query2 += ` WHERE id IN ( SELECT sm_table_connection FROM stakeholder_matrix WHERE id = ${properties.stakeholder_matrix} ) RETURNING *`
                    let updatedDeliverable = await db.query(query2, {
                        type: Sequelize.QueryTypes.UPDATE,
                        replacements: cols2,
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