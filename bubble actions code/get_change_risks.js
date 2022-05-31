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

                try {
                    deliverable.col_config.forEach((config, index) => {
                        if (config.orignal_title == 'risk') {
                            deliverable.col_data[index] = ((risks[0][0] && risks[0][0].change_risks) || '').split('\n')
                        }
                    })
                } catch (e) { }
                deliverable.risks = risks

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