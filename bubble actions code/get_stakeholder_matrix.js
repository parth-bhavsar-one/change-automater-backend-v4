function(properties, context) {

    const { Sequelize } = require('sequelize')
    const db = new Sequelize(context.keys['PostgreSQL Connection URL'])
    // let config = JSON.parse(properties.config)
    let res = {
        data: '',
    }

    let content = context.async(async (callback) => {

        let query = `SELECt * FROM spreadsheets_data WHERE id IN (SELECT sm_table_connection FROM stakeholder_matrix WHERE id = ${properties.id})`;

        db.query(query)
            .then(async (data) => {
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

                let businessUnits = await db.query(`SELECT business_units FROM scopings WHERE id = ${properties.scoping}`)
                let impactLevel = await db.query(`SELECT level FROM impacts WHERE scoping = ${properties.scoping}`)

                businessUnits = JSON.parse(businessUnits[0][0].business_units || '[]')
                impactLevel = impactLevel[0].map((item) => { return item.level })

                deliverable.businessUnits = businessUnits
                deliverable.impactLevel = impactLevel
                try {
                    deliverable.col_config.forEach((config, index) => {
                        if (config.orignal_title == 'division') {
                            deliverable.col_data[index] = businessUnits
                        }
                        if (config.orignal_title == 'levelofimpact') {
                            deliverable.col_data[index] = impactLevel
                        }
                    })
                } catch (e) { }


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