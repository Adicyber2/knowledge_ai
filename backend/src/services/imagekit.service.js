import ImageKit from "imagekit";

let imagekitClient = null;

export const getImageKitClient = () => {
  if (imagekitClient) return imagekitClient;

  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY || "";
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY || "";
  const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT || "https://ik.imagekit.io/adityadeshmukh";

  const isConfigured = Boolean(publicKey && privateKey);
  console.log(`[IMAGEKIT] ImageKit SDK initialized (Configured: ${isConfigured})`);

  imagekitClient = new ImageKit({
    publicKey,
    privateKey,
    urlEndpoint,
  });

  return imagekitClient;
};

export const uploadFileToImageKit = async ({ buffer, fileName, folder = "/knowledge/pdfs/" }) => {
  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY || "";
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY || "";

  if (publicKey.trim() && privateKey.trim()) {
    try {
      const imagekit = getImageKitClient();
      const base64File = buffer.toString("base64");

      const response = await imagekit.upload({
        file: base64File,
        fileName,
        folder,
      });

      if (response && response.url) {
        console.log(`[IMAGEKIT SUCCESS] File uploaded to ImageKit folder '${folder}': ${response.url}`);
        return response.url;
      }
    } catch (error) {
      let rawMsg = error?.message || (typeof error === "object" ? JSON.stringify(error) : String(error));
      const sanitizedMsg = privateKey ? rawMsg.split(privateKey).join("[REDACTED]") : rawMsg;
      console.warn(`[IMAGEKIT WARNING] ImageKit cloud upload failed (${sanitizedMsg}). Using fallback storage.`);
    }
  } else {
    console.warn("[IMAGEKIT WARNING] ImageKit keys missing from environment. Using fallback storage.");
  }

  // Fallback storage: save to local disk under uploads/ directory
  try {
    const pathModule = await import("path");
    const fsModule = await import("fs");
    const ext = fileName.endsWith(".pdf") ? ".pdf" : (pathModule.default.extname(fileName) || ".pdf");
    const cleanFilename = `pdf_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    const uploadPath = pathModule.default.join(process.cwd(), "uploads", cleanFilename);

    await fsModule.default.promises.writeFile(uploadPath, buffer);
    const localUrl = `https://knowledge-backend-jzuz.onrender.com/uploads/${cleanFilename}`;
    console.log(`[STORAGE FALLBACK] Saved PDF file to local storage: ${localUrl}`);
    return localUrl;

  } catch (fsErr) {
    console.error("[STORAGE ERROR] Failed to save file to local disk:", fsErr.message);
    throw new Error(`File upload storage failed: ${fsErr.message}`);
  }
};
