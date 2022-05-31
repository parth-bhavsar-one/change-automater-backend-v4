function(properties, context) {

    const { Sequelize } = require('sequelize')
    const db = new Sequelize(context.keys['PostgreSQL Connection URL'])
    // let config = JSON.parse(properties.config)
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
                dia = parseSpreadSheetData((dia[0][0] || {}))
                sm = parseSpreadSheetData((sm[0][0] || {}))

                try {
                    // Columns from Detailed Impact Assessment Spreadsheet
                    // deliverable.test.push(dia.col_config)
                    (deliverable.col_config || []).forEach((d_config, d_index) => {
                        if (["whatprocesswillchange", "asisdescription", "tobedescription"].includes(d_config.orignal_title)) {
                            // These columns need to be populated from the dia spreadsheet
                            dia.col_config.forEach((dia_config, dia_index) => {
                                if (d_config.src_col_title == dia_config.orignal_title) {
                                    deliverable.col_data[d_index] = dia.col_data[dia_index]
                                    deliverable.types[d_index] = dia.types[dia_index]
                                }
                            })
                        }
                        if (["stakeholderroleswiththislearning"].includes(d_config.orignal_title)) {
                            // These columns need to be populated from the sm spreadsheet

                            sm.col_config.forEach((sm_config, sm_index) => {
                                if (d_config.src_col_title == sm_config.orignal_title) {
                                    deliverable.col_data[d_index] = sm.col_data[sm_index]
                                    deliverable.types[d_index] = sm.types[sm_index]
                                }
                            })
                        }
                    })
                } catch (e) {
                    console.log(e)
                }

                res.data = JSON.stringify(deliverable)
                callback(null, res)
            })
            .catch(e => {
                res.data = JSON.stringify(e)
                callback(null, res)
            })
    })

    return content
}