if (process.env.NODE_ENV != "production") {
	require("dotenv").config({ path: ".env" })
}

const express = require("express")
const app = express()
const cors = require("cors")

app.use(
	cors({
		origin: [/^http:\/\/localhost/],
		credentials: true,
	})
)

app.use(express.urlencoded({ extended: true }));
// app.use(express.bodyParser());
app.use(express.json())

// Routes
app.use(require("./routes/deliverable_task_linking"))
app.use(require("./routes/get_spreadsheet"))
app.use(require("./routes/update_spreadsheet"))

// Handle Errors
app.use(function (err, req, res, next) {
	console.error(err.stack)
	res.status(500).json({ error: true, msg: 'Something broke!' })
})

const port = process.env.PORT || 5000
app.listen(port, () => {
	console.log(`Server is running on port: ${port}`)
})