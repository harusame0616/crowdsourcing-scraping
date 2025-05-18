-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('Coconala', 'Lancers', 'CrowdWorks');

-- CreateTable
CREATE TABLE "Project" (
    "projectId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hiddenId" TEXT,
    "visibleId" TEXT,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("projectId","platform")
);

-- CreateTable
CREATE TABLE "ProjectHidden" (
    "hiddenId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectHidden_pkey" PRIMARY KEY ("hiddenId")
);

-- CreateTable
CREATE TABLE "ProjectVisible" (
    "visibleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fixedWageId" TEXT,
    "timeWageId" TEXT,

    CONSTRAINT "ProjectVisible_pkey" PRIMARY KEY ("visibleId")
);

-- CreateTable
CREATE TABLE "ProjectFixedWage" (
    "fixedWageId" TEXT NOT NULL,
    "budgetMin" INTEGER,
    "budgetMax" INTEGER,
    "deliveryDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectFixedWage_pkey" PRIMARY KEY ("fixedWageId")
);

-- CreateTable
CREATE TABLE "ProjectTimeWage" (
    "timeWageId" TEXT NOT NULL,
    "workingTime" INTEGER,
    "budgetMin" INTEGER,
    "budgetMax" INTEGER,
    "periodMin" INTEGER,
    "periodMax" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectTimeWage_pkey" PRIMARY KEY ("timeWageId")
);

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_hiddenId_fkey" FOREIGN KEY ("hiddenId") REFERENCES "ProjectHidden"("hiddenId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_visibleId_fkey" FOREIGN KEY ("visibleId") REFERENCES "ProjectVisible"("visibleId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectVisible" ADD CONSTRAINT "ProjectVisible_fixedWageId_fkey" FOREIGN KEY ("fixedWageId") REFERENCES "ProjectFixedWage"("fixedWageId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectVisible" ADD CONSTRAINT "ProjectVisible_timeWageId_fkey" FOREIGN KEY ("timeWageId") REFERENCES "ProjectTimeWage"("timeWageId") ON DELETE SET NULL ON UPDATE CASCADE;
