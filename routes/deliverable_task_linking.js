const express = require("express");
const { Sequelize } = require('sequelize')

const tasksRoutes = express.Router();

tasksRoutes.route("/api/deliverable_task_linking").post(async (req, res) => {

    let db = require('../conn.js')
    let sheetData = {}

    // Se if the data in the body is useable
    try {
        sheetData = JSON.parse(req.body.sheet_data)
    } catch (e) {
        console.log(e, req.body)
        res.json({ 'error': 'Invalid JSON body', body: req.body.sheet_data, e })
        return
    }

    let taskColumn = [];

    // Only 2 columns are linked to tasks.
    // Action required is the one from the Detailed Impact Assessment and Tasks is the one from Stakeholder Matrix
    let colName = req.body.deliverable == 'Detailed Impact Assessment' ? 'actionrequired' : 'tasks';

    // Get the column linked to the tasks
    (sheetData?.col_config || []).forEach((col, index) => {
        if (col.orignal_title == colName) {
            taskColumn = sheetData.col_data[index]
        }
    })

    // Return already because either the column linked to tasks wasn't found or have no values
    if (taskColumn.length == 0) {
        res.json({ 'msg': 'Nothing to upate!' })
        return
    }

    // Get the main project
    let projectSQL = 'select * from projects where id = ?';
    let project = await db.query(projectSQL, { replacements: [Number(req.body.pid)], type: Sequelize.QueryTypes.SELECT })

    // return if project is empty
    if (!project[0]) {
        res.json({ 'error': 'Project not found!' })
        return
    }

    // Get all the tasks related to this project
    let tasksSQL = 'select * from tasks where project_id = ? and deliverable_id = ?';
    let tasks = await db.query(tasksSQL, { replacements: [Number(req.body.pid), Number(req.body.deliverable_id)], type: Sequelize.QueryTypes.SELECT })

    // Find the tasks already linked.
    let tasks_linked = [], tasks_to_unlink = [], ids_linked = [], ids_not_linked = [];

    // filter the existing tasks linked to these ids
    sheetData.row_ids.forEach((row_id, index) => {
        let task = tasks?.find(task => task.spreadsheet_row_id == row_id)

        if (task) {
            tasks_linked.push({
                task: task,
                row_index: index,
                new_title: taskColumn[index]
            })
            ids_linked.push(row_id)
        }
    })

    // Not sure if Should delete these tasks, need to discuss
    tasks_to_unlink = tasks.filter(task => !ids_linked.includes(task.spreadsheet_row_id))

    // These are the rows agaist which there is currently no task. so need to create new tasks
    ids_not_linked = sheetData.row_ids.filter(row_id => !ids_linked.includes(row_id))

    // Multistatement update query
    let updateQuery = ''
    let replacements = [];

    tasks_linked.forEach((task, index) => {
        if (task.new_title != task.task.task_name && task.new_title != '') {
            updateQuery += `update tasks set task_name = ? where id = ?;`
            replacements.push(task.new_title)
            replacements.push(task.task.id)
        }
    })
    if (updateQuery != '') {
        await db.query(updateQuery, { replacements: replacements, type: Sequelize.QueryTypes.UPDATE })
    }

    // Create new tasks
    let values = ''
    ids_not_linked.forEach(async (row_id, index) => {
        if (taskColumn[sheetData.row_ids.indexOf(row_id)] != '') {
            let createQuery = `INSERT INTO tasks(
                task_name, description, progress, status,
                project_id, project_name, deliverable, spreadsheet_row_id, deliverable_id
            ) VALUES (
                ?, ?, ?, ?,
                ?, ?, ?, ?, ?
                )`
            let createReplacements = [
                taskColumn[sheetData.row_ids.indexOf(row_id)], '', 0, 'In progress',
                project[0].id, project[0].project_name, req.body.deliverable, row_id, Number(req.body.deliverable_id)
            ]

            await db.query(createQuery, { replacements: createReplacements, type: Sequelize.QueryTypes.INSERT })
        }
    })

    /*
    Removing update spreadsheet for test purpose
    // Save the spreadsheet data now.
    let query = `UPDATE spreadsheets_data set columns_titles = ?, columns_widths = ?, columns_types = ?, col_config = ?, row_ids = ?, `

        let data = sheetData;

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
    */
    res.json({ type: 'success', msg: 'Tasks updated!' })

})

module.exports = tasksRoutes;