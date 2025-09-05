"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.nextServer = exports.generateThumbnail = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const sharp_1 = __importDefault(require("sharp"));
admin.initializeApp();
exports.generateThumbnail = functions.storage
    .object()
    .onFinalize(async (object) => {
    const filePath = object.name || '';
    if (!filePath.startsWith('uploads/'))
        return;
    if (!object.contentType?.startsWith('image/'))
        return;
    const bucket = admin.storage().bucket();
    const [fileBuffer] = await bucket.file(filePath).download();
    const thumbnail = await (0, sharp_1.default)(fileBuffer).resize(640).jpeg({ quality: 80 }).toBuffer();
    const thumbPath = filePath.replace('uploads/', 'thumbnails/') + '.jpg';
    await bucket.file(thumbPath).save(thumbnail, { contentType: 'image/jpeg' });
});
exports.nextServer = functions.https.onRequest(async (req, res) => {
    // Placeholder for Next.js SSR hosting integration (via Firebase Hosting rewrite).
    res.status(200).send('Next server placeholder. Deploy app with next export or use Firebase integration.');
});
