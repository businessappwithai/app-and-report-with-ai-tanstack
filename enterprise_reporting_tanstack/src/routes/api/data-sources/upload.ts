import { createFileRoute } from "@tanstack/react-router";
import { json } from "@/lib/server/response";
import { auth } from "@/lib/auth/config";
import { getDb } from "@/lib/db/config";

async function getSession(request: Request) {
  return auth(request);
}

export const Route = createFileRoute("/api/data-sources/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const session = await getSession(request);
          if (!session?.user) {
            return json(
              { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
              { status: 401 }
            );
          }

          const formData = await request.formData();
          const file = formData.get("file") as File | null;

          if (!file) {
            return json(
              { success: false, error: { message: "No file provided" } },
              { status: 400 }
            );
          }

          // Validate file type (SQLite database files)
          const validExtensions = [".db", ".sqlite", ".sqlite3"];
          const fileName = file.name;
          const isValidFile = validExtensions.some((ext) => fileName.toLowerCase().endsWith(ext));

          if (!isValidFile) {
            return json(
              {
                success: false,
                error: {
                  message:
                    "Invalid file type. Please upload a SQLite database file (.db, .sqlite, .sqlite3)",
                },
              },
              { status: 400 }
            );
          }

          // For now, just return the filename - the file is stored client-side in a File object
          // In a production system, you would store the file on the server and return a path
          return json(
            {
              success: true,
              data: {
                filename: fileName,
                message: "File accepted. The database will be referenced by this name.",
              },
            },
            { status: 201 }
          );
        } catch (error) {
          console.error("Error uploading data source:", error);
          return json(
            {
              success: false,
              error: { code: "SERVER_ERROR", message: "Failed to upload data source" },
            },
            { status: 500 }
          );
        }
      },
    },
  },
});
