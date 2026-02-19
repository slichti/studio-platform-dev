import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestDb } from './test-utils';
import * as schema from '@studio/db/src/schema';
import { eq } from 'drizzle-orm';

const TENANT_ID = 'quiz_tenant';
const USER_ID = 'student_1';
const ADMIN_ID = 'admin_user';

describe('Course Quiz System (Integration)', () => {
    let db: any;

    beforeAll(async () => {
        db = await setupTestDb(env.DB);

        // Setup Tenant
        await db.insert(schema.tenants).values({ id: TENANT_ID, name: 'Quiz Studio', slug: 'quiz-studio' }).run();

        // Setup Admin
        await db.insert(schema.users).values({ id: ADMIN_ID, email: 'admin@test.com' }).run();
        await db.insert(schema.tenantMembers).values({ id: 'member_admin', tenantId: TENANT_ID, userId: ADMIN_ID }).run();
        await db.insert(schema.tenantRoles).values({ id: 'role_admin', memberId: 'member_admin', role: 'admin' }).run();

        // Setup Student
        await db.insert(schema.users).values({ id: USER_ID, email: 'student@test.com' }).run();
        await db.insert(schema.tenantMembers).values({ id: 'member_1', tenantId: TENANT_ID, userId: USER_ID, role: 'user' }).run();
    });

    it('should create and retrieve a quiz with questions', async () => {
        const quizData = {
            title: 'Anatomy 101 Quiz',
            description: 'Test your knowledge of the human body.',
            passingScore: 70,
            questions: [
                {
                    questionText: 'How many bones are in the adult human body?',
                    questionType: 'multiple_choice',
                    options: [
                        { label: '206', value: '206' },
                        { label: '300', value: '300' }
                    ],
                    correctAnswer: '206',
                    points: 5
                },
                {
                    questionText: 'The humerus is located in the arm.',
                    questionType: 'true_false',
                    correctAnswer: 'true',
                    points: 2
                }
            ]
        };

        const res = await SELF.fetch('http://localhost/quizzes', {
            method: 'POST',
            body: JSON.stringify(quizData),
            headers: {
                'Content-Type': 'application/json',
                'X-Tenant-Id': TENANT_ID,
                'TEST-AUTH': 'admin_user' // Assume admin bypass
            }
        });

        const data = await res.json() as any;
        expect(res.status).toBe(200);
        expect(data.id).toBeDefined();

        const quizId = data.id;

        // Retrieve the quiz
        const getRes = await SELF.fetch(`http://localhost/quizzes/${quizId}`, {
            headers: {
                'X-Tenant-Id': TENANT_ID,
                'TEST-AUTH': USER_ID
            }
        });

        const quiz = await getRes.json() as any;
        expect(quiz.title).toBe('Anatomy 101 Quiz');
        expect(quiz.questions).toHaveLength(2);
        expect(quiz.questions[0].correctAnswer).toBeUndefined(); // Should be stripped for students
    });

    it('should calculate score and pass/fail for a submission', async () => {
        // 1. Create Quiz manually in DB for predictable IDs
        const QUIZ_ID = 'q_test_1';
        const Q1_ID = 'qq_1';
        const Q2_ID = 'qq_2';

        await db.insert(schema.quizzes).values({
            id: QUIZ_ID,
            tenantId: TENANT_ID,
            title: 'Scoring Test',
            passingScore: 50
        }).run();

        await db.insert(schema.quizQuestions).values([
            {
                id: Q1_ID,
                quizId: QUIZ_ID,
                questionText: 'Correct?',
                questionType: 'true_false',
                correctAnswer: 'true',
                points: 10,
                order: 0
            },
            {
                id: Q2_ID,
                quizId: QUIZ_ID,
                questionText: 'Wrong?',
                questionType: 'true_false',
                correctAnswer: 'false',
                points: 10,
                order: 1
            }
        ]).run();

        // 2. Submit answers (1 correct, 1 wrong = 50%)
        const submissionData = {
            answers: {
                [Q1_ID]: 'true',
                [Q2_ID]: 'true' // Wrong
            }
        };

        const res = await SELF.fetch(`http://localhost/quizzes/${QUIZ_ID}/submit`, {
            method: 'POST',
            body: JSON.stringify(submissionData),
            headers: {
                'Content-Type': 'application/json',
                'X-Tenant-Id': TENANT_ID,
                'TEST-AUTH': USER_ID
            }
        });

        const result = await res.json() as any;
        expect(res.status).toBe(200);
        expect(result.score).toBe(50);
        expect(result.passed).toBe(true);
        expect(result.results[0].isCorrect).toBe(true);
        expect(result.results[1].isCorrect).toBe(false);

        // Verify record in DB
        const sub = await db.select().from(schema.quizSubmissions).where(eq(schema.quizSubmissions.id, result.submissionId)).get();
        expect(sub).toBeDefined();
        expect(sub.score).toBe(50);
    });

    it('should return quizzes within a Course collection', async () => {
        const COURSE_CLASS_ID = 'c_course_1';
        const COLLECTION_ID = 'vc_1';
        const QUIZ_ID = 'q_course_quiz';

        // 1. Setup Class and Collection
        await db.insert(schema.classes).values({
            id: COURSE_CLASS_ID,
            tenantId: TENANT_ID,
            title: 'Course with Quiz',
            startTime: new Date(),
            durationMinutes: 60,
            isCourse: true
        }).run();

        await db.insert(schema.videoCollections).values({
            id: COLLECTION_ID,
            tenantId: TENANT_ID,
            title: 'Course Content',
            slug: 'course-content'
        }).run();

        await db.update(schema.classes).set({ contentCollectionId: COLLECTION_ID }).where(eq(schema.classes.id, COURSE_CLASS_ID)).run();

        // 2. Add Quiz to Collection
        await db.insert(schema.quizzes).values({
            id: QUIZ_ID,
            tenantId: TENANT_ID,
            title: 'Mid-Course Quiz'
        }).run();

        await db.insert(schema.videoCollectionItems).values({
            id: 'vci_1',
            collectionId: COLLECTION_ID,
            contentType: 'quiz',
            quizId: QUIZ_ID,
            order: 0
        }).run();

        // 3. Setup access (individual purchase)
        await db.insert(schema.videoPurchases).values({
            id: 'vp_1',
            tenantId: TENANT_ID,
            userId: USER_ID,
            classId: COURSE_CLASS_ID,
            pricePaid: 1000
        }).run();

        // 4. Fetch content
        const res = await SELF.fetch(`http://localhost/classes/${COURSE_CLASS_ID}/recording`, {
            headers: {
                'X-Tenant-Id': TENANT_ID,
                'TEST-AUTH': USER_ID
            }
        });

        const data = await res.json() as any;
        expect(res.status).toBe(200);
        expect(data.videos).toHaveLength(1);
        expect(data.videos[0].type).toBe('quiz');
        expect(data.videos[0].title).toBe('Mid-Course Quiz');
    });
});
