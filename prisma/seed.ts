import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Create the poll with id=1
  await prisma.poll.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      isOpen: true,
    },
  })

  console.log('✅ Poll created successfully')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
