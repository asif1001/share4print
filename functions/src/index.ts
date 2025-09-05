import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import sharp from 'sharp'

admin.initializeApp()

export const generateThumbnail = functions.storage
  .object()
  .onFinalize(async (object: functions.storage.ObjectMetadata) => {
    const filePath = object.name || ''
    if (!filePath.startsWith('uploads/')) return
    if (!object.contentType?.startsWith('image/')) return

    const bucket = admin.storage().bucket()
    const [fileBuffer] = await bucket.file(filePath).download()
    const thumbnail = await sharp(fileBuffer).resize(640).jpeg({ quality: 80 }).toBuffer()

    const thumbPath = filePath.replace('uploads/', 'thumbnails/') + '.jpg'
    await bucket.file(thumbPath).save(thumbnail, { contentType: 'image/jpeg' })
  })

export const nextServer = functions.https.onRequest(async (req: functions.https.Request, res: functions.Response) => {
  // Placeholder for Next.js SSR hosting integration (via Firebase Hosting rewrite).
  res.status(200).send('Next server placeholder. Deploy app with next export or use Firebase integration.')
})
