import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { DocumentType } from "@prisma/client"
import fs from "fs/promises"
import path from "path"

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const programId = formData.get("programId") as string | null
    const documentType = formData.get("documentType") as string | null
    const effectiveDate = formData.get("effectiveDate") as string | null
    const uploadedBy = (formData.get("uploadedBy") as string | null) ?? "system"

    if (!file || !programId || !documentType) {
      return NextResponse.json(
        { error: "file, programId, and documentType are required" },
        { status: 400 }
      )
    }

    // On Vercel, only /tmp is writable; locally use STORAGE_BASE_PATH or ./uploads
    const uploadsDir = process.env.VERCEL
      ? "/tmp/uploads"
      : path.resolve(process.env.STORAGE_BASE_PATH ?? path.join(process.cwd(), "uploads"))

    await fs.mkdir(uploadsDir, { recursive: true })

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const storedName = `${Date.now()}-${safeName}`
    const storagePath = path.join(uploadsDir, storedName)

    const buffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(storagePath, buffer)

    const doc = await prisma.contractDocument.create({
      data: {
        programId,
        documentType: documentType as DocumentType,
        fileName: file.name,
        fileSize: file.size,
        storagePath,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
        uploadedBy,
      },
    })

    return NextResponse.json({ data: doc }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/contracts/upload]", err)
    return NextResponse.json({ error: "Upload failed", detail: String(err) }, { status: 500 })
  }
}
