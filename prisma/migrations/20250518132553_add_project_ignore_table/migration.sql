-- CreateTable
CREATE TABLE "ProjectIgnore" (
    "projectId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectIgnore_pkey" PRIMARY KEY ("projectId","platform")
);

-- AddForeignKey
ALTER TABLE "ProjectIgnore" ADD CONSTRAINT "ProjectIgnore_projectId_platform_fkey" FOREIGN KEY ("projectId", "platform") REFERENCES "Project"("projectId", "platform") ON DELETE RESTRICT ON UPDATE CASCADE;
