import cors from 'cors'
import express from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import multer from 'multer'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const dataDir = path.join(rootDir, 'data')
const uploadsDir = path.join(rootDir, 'uploads')
const submissionsFile = path.join(dataDir, 'submissions.json')
const distDir = path.join(rootDir, 'dist')
const indexFile = path.join(distDir, 'index.html')
const port = Number(process.env.PORT ?? 8787)

await fs.mkdir(dataDir, { recursive: true })
await fs.mkdir(uploadsDir, { recursive: true })

try {
  await fs.access(submissionsFile)
} catch {
  await fs.writeFile(submissionsFile, '[]\n', 'utf8')
}

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadsDir)
  },
  filename: (_req, file, callback) => {
    const safeName = file.originalname.replace(/[^\w.-]/g, '_')
    callback(null, `${Date.now()}-${safeName}`)
  },
})

const upload = multer({
  storage,
  limits: {
    files: 5,
    fileSize: 10 * 1024 * 1024,
  },
})

const app = express()

app.use(
  cors({
    origin: true,
    credentials: false,
  }),
)
app.use(express.json({ limit: '2mb' }))
app.use('/uploads', express.static(uploadsDir))
app.use(express.static(distDir))

async function readSubmissions() {
  const raw = await fs.readFile(submissionsFile, 'utf8')
  return JSON.parse(raw)
}

async function writeSubmissions(records) {
  await fs.writeFile(submissionsFile, `${JSON.stringify(records, null, 2)}\n`, 'utf8')
}

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'renovation-estimate-api',
    date: new Date().toISOString(),
  })
})

app.get('/api/submissions', async (_req, res, next) => {
  try {
    const records = await readSubmissions()
    res.json(records)
  } catch (error) {
    next(error)
  }
})

app.post('/api/submissions', upload.array('images', 5), async (req, res, next) => {
  try {
    const payload = JSON.parse(req.body.payload ?? '{}')
    const files = Array.isArray(req.files) ? req.files : []

    const record = {
      ...payload,
      id: `${Date.now()}`,
      imageNames:
        files.length > 0 ? files.map((file) => file.originalname) : payload.imageNames ?? [],
      uploadedImages:
        files.length > 0 ? files.map((file) => `/uploads/${file.filename}`) : payload.uploadedImages ?? [],
      submittedAt: new Date().toLocaleString('ja-JP'),
    }

    const records = await readSubmissions()
    const nextRecords = [record, ...records]
    await writeSubmissions(nextRecords)

    res.status(201).json(record)
  } catch (error) {
    next(error)
  }
})

app.use(async (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    next()
    return
  }

  try {
    await fs.access(indexFile)
    res.sendFile(indexFile)
  } catch {
    res.status(404).send('dist が見つかりません。先に npm run build を実行してください。')
  }
})

app.use((error, _req, res, _next) => {
  console.error(error)
  res.status(500).json({
    message: 'サーバー処理中にエラーが発生しました。',
  })
})

app.listen(port, () => {
  console.log(`Renovation estimate API listening on http://localhost:${port}`)
})
