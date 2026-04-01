import "dotenv/config";
import { auth } from "../src/app/lib/auth";
import { prisma } from "../src/app/lib/prisma";
import {
    EventLocationType,
    EventPricingType,
    EventStatus,
    EventVisibility,
    UserRole,
    UserStatus,
} from "../src/generated/prisma/enums";

type SeedUser = {
    email: string;
    name: string;
    password: string;
    role?: UserRole;
    phone?: string;
    bio?: string;
    image?: string;
};

type SeedEvent = {
    ownerEmail: string;
    title: string;
    slug: string;
    summary: string;
    description: string;
    startsAt: Date;
    endsAt?: Date;
    locationType: EventLocationType;
    venue?: string;
    eventLink?: string;
    visibility: EventVisibility;
    pricingType: EventPricingType;
    registrationFee?: number;
    currency?: string;
    capacity?: number;
    bannerImage?: string;
    isFeatured?: boolean;
    featuredAt?: Date;
};

const seedUsers: SeedUser[] = [
    {
        email: "admin@meetrix.dev",
        name: "Meetrix Admin",
        password: "Admin123456",
        role: UserRole.ADMIN,
        phone: "+8801700000001",
        bio: "Platform administrator for Meetrix demo data.",
        image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
    },
    {
        email: "sadia@meetrix.dev",
        name: "Sadia Rahman",
        password: "User123456",
        phone: "+8801700000002",
        bio: "Community builder who hosts creative and networking events.",
        image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80",
    },
    {
        email: "fahim@meetrix.dev",
        name: "Fahim Hasan",
        password: "User123456",
        phone: "+8801700000003",
        bio: "Product-minded organizer focused on startup and growth events.",
        image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80",
    },
    {
        email: "nabila@meetrix.dev",
        name: "Nabila Sultana",
        password: "User123456",
        phone: "+8801700000004",
        bio: "Hosts design and creator meetups across Dhaka.",
        image: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=400&q=80",
    },
    {
        email: "tanvir@meetrix.dev",
        name: "Tanvir Ahmed",
        password: "User123456",
        phone: "+8801700000005",
        bio: "Coordinates private community events and mentoring sessions.",
        image: "https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=400&q=80",
    },
];

const now = new Date();
const addDays = (days: number, hour = 18, minute = 0) =>
    new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + days,
        hour,
        minute,
        0,
        0,
    );

const addHours = (date: Date, hours: number) =>
    new Date(date.getTime() + hours * 60 * 60 * 1000);

const seedEvents: SeedEvent[] = [
    {
        ownerEmail: "sadia@meetrix.dev",
        title: "Meetrix Launch Summit 2026",
        slug: "meetrix-launch-summit-2026",
        summary: "A flagship community event bringing builders, founders, and creators together.",
        description:
            "Meetrix Launch Summit 2026 is the featured showcase event for our demo platform. It highlights community-led sessions, founder stories, networking, and product showcases.",
        startsAt: addDays(3, 17, 30),
        endsAt: addHours(addDays(3, 17, 30), 4),
        locationType: EventLocationType.OFFLINE,
        venue: "International Convention City Bashundhara, Dhaka",
        visibility: EventVisibility.PUBLIC,
        pricingType: EventPricingType.FREE,
        registrationFee: 0,
        capacity: 500,
        bannerImage: "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80",
        isFeatured: true,
        featuredAt: now,
    },
    {
        ownerEmail: "fahim@meetrix.dev",
        title: "Startup Growth Roundtable",
        slug: "startup-growth-roundtable",
        summary: "A practical session on customer acquisition, pricing, and retention.",
        description:
            "An in-person roundtable for startup operators and founders focused on early growth systems, retention strategies, and GTM lessons.",
        startsAt: addDays(5, 19, 0),
        endsAt: addHours(addDays(5, 19, 0), 3),
        locationType: EventLocationType.OFFLINE,
        venue: "Banani, Dhaka",
        visibility: EventVisibility.PUBLIC,
        pricingType: EventPricingType.PAID,
        registrationFee: 499,
        capacity: 80,
        bannerImage: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80",
    },
    {
        ownerEmail: "nabila@meetrix.dev",
        title: "Design Systems for Fast Teams",
        slug: "design-systems-for-fast-teams",
        summary: "A designer-focused workshop on scalable systems and collaboration.",
        description:
            "A workshop for product designers and frontend engineers exploring token strategy, component governance, and design system workflows.",
        startsAt: addDays(7, 18, 0),
        endsAt: addHours(addDays(7, 18, 0), 2),
        locationType: EventLocationType.ONLINE,
        eventLink: "https://meet.example.com/design-systems",
        visibility: EventVisibility.PUBLIC,
        pricingType: EventPricingType.FREE,
        registrationFee: 0,
        capacity: 250,
        bannerImage: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80",
    },
    {
        ownerEmail: "tanvir@meetrix.dev",
        title: "Private Founder Circle Dinner",
        slug: "private-founder-circle-dinner",
        summary: "An invite-only dinner for founders and operators.",
        description:
            "A private small-group dinner for curated founder conversations, peer mentoring, and strategic collaboration opportunities.",
        startsAt: addDays(8, 20, 0),
        endsAt: addHours(addDays(8, 20, 0), 2),
        locationType: EventLocationType.OFFLINE,
        venue: "Gulshan 2, Dhaka",
        visibility: EventVisibility.PRIVATE,
        pricingType: EventPricingType.FREE,
        registrationFee: 0,
        capacity: 20,
        bannerImage: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=80",
    },
    {
        ownerEmail: "sadia@meetrix.dev",
        title: "Community Builder Masterclass",
        slug: "community-builder-masterclass",
        summary: "A practical class on building engaged communities from zero to one.",
        description:
            "This session covers onboarding systems, content rhythms, moderation culture, and how to turn passive audiences into active communities.",
        startsAt: addDays(10, 18, 30),
        endsAt: addHours(addDays(10, 18, 30), 3),
        locationType: EventLocationType.ONLINE,
        eventLink: "https://meet.example.com/community-masterclass",
        visibility: EventVisibility.PUBLIC,
        pricingType: EventPricingType.PAID,
        registrationFee: 799,
        capacity: 150,
        bannerImage: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80",
    },
    {
        ownerEmail: "fahim@meetrix.dev",
        title: "AI Product Jam",
        slug: "ai-product-jam",
        summary: "A collaborative jam session for AI product ideas and prototyping.",
        description:
            "Participants bring early-stage AI ideas, form small groups, and work through product framing, user value, and MVP plans.",
        startsAt: addDays(12, 17, 0),
        endsAt: addHours(addDays(12, 17, 0), 4),
        locationType: EventLocationType.OFFLINE,
        venue: "Dhaka Innovation Hub",
        visibility: EventVisibility.PUBLIC,
        pricingType: EventPricingType.FREE,
        registrationFee: 0,
        capacity: 120,
        bannerImage: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
    },
    {
        ownerEmail: "nabila@meetrix.dev",
        title: "Creator Studio Intensive",
        slug: "creator-studio-intensive",
        summary: "A paid workshop for creators working on content, brand, and audience growth.",
        description:
            "A hands-on session for creators covering content systems, audience positioning, monetization, and collaborative promotion.",
        startsAt: addDays(14, 16, 0),
        endsAt: addHours(addDays(14, 16, 0), 3),
        locationType: EventLocationType.OFFLINE,
        venue: "Dhanmondi, Dhaka",
        visibility: EventVisibility.PUBLIC,
        pricingType: EventPricingType.PAID,
        registrationFee: 999,
        capacity: 60,
        bannerImage: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80",
    },
    {
        ownerEmail: "tanvir@meetrix.dev",
        title: "Private Angel Network Mixer",
        slug: "private-angel-network-mixer",
        summary: "A private paid mixer connecting founders with angel investors.",
        description:
            "A curated networking evening for angel investors and founders with structured introductions and moderated matchmaking.",
        startsAt: addDays(16, 19, 30),
        endsAt: addHours(addDays(16, 19, 30), 2),
        locationType: EventLocationType.OFFLINE,
        venue: "Gulshan Club, Dhaka",
        visibility: EventVisibility.PRIVATE,
        pricingType: EventPricingType.PAID,
        registrationFee: 1500,
        capacity: 40,
        bannerImage: "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=80",
    },
    {
        ownerEmail: "sadia@meetrix.dev",
        title: "Women in Tech Connect",
        slug: "women-in-tech-connect",
        summary: "A networking event for women building careers in technology.",
        description:
            "An evening of networking, mentorship, and career conversations for women in product, engineering, and design.",
        startsAt: addDays(18, 18, 0),
        endsAt: addHours(addDays(18, 18, 0), 3),
        locationType: EventLocationType.OFFLINE,
        venue: "Mohakhali DOHS, Dhaka",
        visibility: EventVisibility.PUBLIC,
        pricingType: EventPricingType.FREE,
        registrationFee: 0,
        capacity: 180,
        bannerImage: "https://images.unsplash.com/photo-1515169067868-5387ec356754?auto=format&fit=crop&w=1200&q=80",
    },
    {
        ownerEmail: "fahim@meetrix.dev",
        title: "SaaS Metrics Deep Dive",
        slug: "saas-metrics-deep-dive",
        summary: "A live analytical session on retention, CAC, LTV, and revenue quality.",
        description:
            "A focused analytics session for SaaS teams to sharpen the way they measure and communicate business performance.",
        startsAt: addDays(20, 20, 0),
        endsAt: addHours(addDays(20, 20, 0), 2),
        locationType: EventLocationType.ONLINE,
        eventLink: "https://meet.example.com/saas-metrics",
        visibility: EventVisibility.PUBLIC,
        pricingType: EventPricingType.FREE,
        registrationFee: 0,
        capacity: 300,
        bannerImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80",
    },
    {
        ownerEmail: "nabila@meetrix.dev",
        title: "Product Storytelling Night",
        slug: "product-storytelling-night",
        summary: "A storytelling evening for product teams sharing wins, failures, and lessons.",
        description:
            "A community storytelling format where product teams unpack launches, pivots, and user research moments that changed their direction.",
        startsAt: addDays(22, 18, 30),
        endsAt: addHours(addDays(22, 18, 30), 2),
        locationType: EventLocationType.OFFLINE,
        venue: "Mirpur DOHS, Dhaka",
        visibility: EventVisibility.PUBLIC,
        pricingType: EventPricingType.FREE,
        registrationFee: 0,
        capacity: 90,
        bannerImage: "https://images.unsplash.com/photo-1515165562835-c3b8c5b3130a?auto=format&fit=crop&w=1200&q=80",
    },
];

const ensureUser = async (user: SeedUser) => {
    const existingUser = await prisma.user.findUnique({
        where: {
            email: user.email,
        },
    });

    if (!existingUser) {
        await auth.api.signUpEmail({
            body: {
                email: user.email,
                password: user.password,
                name: user.name,
            },
        });
    }

    return prisma.user.update({
        where: {
            email: user.email,
        },
        data: {
            name: user.name,
            role: user.role ?? UserRole.USER,
            status: UserStatus.ACTIVE,
            phone: user.phone,
            bio: user.bio,
            image: user.image,
            isDeleted: false,
            deletedAt: null,
        },
    });
};

const ensureEvent = async (event: SeedEvent) => {
    const owner = await prisma.user.findUnique({
        where: {
            email: event.ownerEmail,
        },
        select: {
            id: true,
        },
    });

    if (!owner) {
        throw new Error(`Owner not found for seed event: ${event.ownerEmail}`);
    }

    return prisma.event.upsert({
        where: {
            slug: event.slug,
        },
        create: {
            title: event.title,
            slug: event.slug,
            summary: event.summary,
            description: event.description,
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            timezone: "Asia/Dhaka",
            locationType: event.locationType,
            venue: event.venue,
            eventLink: event.eventLink,
            visibility: event.visibility,
            pricingType: event.pricingType,
            registrationFee: event.registrationFee ?? 0,
            currency: event.currency ?? "BDT",
            capacity: event.capacity,
            bannerImage: event.bannerImage,
            isFeatured: event.isFeatured ?? false,
            featuredAt: event.isFeatured ? event.featuredAt ?? new Date() : null,
            status: EventStatus.PUBLISHED,
            ownerId: owner.id,
        },
        update: {
            title: event.title,
            summary: event.summary,
            description: event.description,
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            timezone: "Asia/Dhaka",
            locationType: event.locationType,
            venue: event.venue,
            eventLink: event.eventLink,
            visibility: event.visibility,
            pricingType: event.pricingType,
            registrationFee: event.registrationFee ?? 0,
            currency: event.currency ?? "BDT",
            capacity: event.capacity,
            bannerImage: event.bannerImage,
            isFeatured: event.isFeatured ?? false,
            featuredAt: event.isFeatured ? event.featuredAt ?? new Date() : null,
            status: EventStatus.PUBLISHED,
            isDeleted: false,
            deletedAt: null,
            ownerId: owner.id,
        },
    });
};

const seed = async () => {
    console.log("Seeding users...");

    for (const user of seedUsers) {
        await ensureUser(user);
    }

    console.log("Seeding events...");

    for (const event of seedEvents) {
        await ensureEvent(event);
    }

    const totalUsers = await prisma.user.count();
    const totalEvents = await prisma.event.count();

    console.log(`Seed complete. Users: ${totalUsers}, Events: ${totalEvents}`);
    console.log("Demo credentials:");
    console.log("Admin -> admin@meetrix.dev / Admin123456");
    console.log("Users -> sadia@meetrix.dev / User123456");
};

seed()
    .catch((error) => {
        console.error("Seed failed:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
