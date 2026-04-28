import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"

export async function GET() {
  try {
    const programs = await prisma.program.findMany({
      select: { id: true, name: true, status: true },
      orderBy: { name: "asc" },
    })
    return NextResponse.json({ data: programs })
  } catch (err) {
    console.error("[GET /api/programs]", err)
    return NextResponse.json({ error: "Failed to fetch programs" }, { status: 500 })
  }
}
