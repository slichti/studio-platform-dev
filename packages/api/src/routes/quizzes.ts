import { Hono } from 'hono';
import { createDb } from '../db';
import { quizzes, quizQuestions, quizSubmissions } from '@studio/db/src/schema';
import { eq, and } from 'drizzle-orm';
import type { HonoContext } from '../types';
import { crypto } from '@cloudflare/workers-types';

const app = new Hono<HonoContext>();

// GET / - List all quizzes for the tenant (Admin only)
app.get('/', async (c) => {
    if (!c.get('can')('manage_classes')) {
        return c.json({ error: 'Access Denied' }, 403);
    }
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context missing' }, 400);

    const allQuizzes = await db.select().from(quizzes).where(eq(quizzes.tenantId, tenant.id)).all();
    return c.json(allQuizzes);
});

// POST / - Create a new quiz
app.post('/', async (c) => {
    if (!c.get('can')('manage_classes')) {
        return c.json({ error: 'Access Denied' }, 403);
    }
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context missing' }, 400);

    const { title, description, randomizeOrder, passingScore, questions } = await c.req.json();
    const quizId = `q_${(globalThis as any).crypto.randomUUID()}`;

    await db.insert(quizzes).values({
        id: quizId,
        tenantId: tenant.id,
        title,
        description,
        randomizeOrder: !!randomizeOrder,
        passingScore: passingScore || 0
    }).run();

    if (questions && Array.isArray(questions)) {
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            await db.insert(quizQuestions).values({
                id: `qq_${(globalThis as any).crypto.randomUUID()}`,
                quizId,
                questionText: q.questionText,
                questionType: q.questionType,
                options: q.options,
                correctAnswer: q.correctAnswer,
                explanation: q.explanation,
                points: q.points || 1,
                order: i
            }).run();
        }
    }

    return c.json({ id: quizId, success: true });
});

// GET /:id - Fetch quiz + questions
app.get('/:id', async (c) => {
    const db = createDb(c.env.DB);
    const quizId = c.req.param('id');
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context missing' }, 400);

    const quiz = await db.select().from(quizzes).where(and(eq(quizzes.id, quizId), eq(quizzes.tenantId, tenant.id))).get();
    if (!quiz) return c.json({ error: 'Quiz not found' }, 404);

    const questions = await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, quizId)).orderBy(quizQuestions.order).all();

    // Randomize if requested and not admin (basic shuffle)
    let finalQuestions = questions;
    if (quiz.randomizeOrder && !c.get('can')('manage_classes')) {
        finalQuestions = [...questions].sort(() => Math.random() - 0.5);
    }

    // Strip correct answers if not admin
    if (!c.get('can')('manage_classes')) {
        finalQuestions = (finalQuestions as any[]).map(q => ({
            ...q,
            correctAnswer: undefined
        }));
    }

    return c.json({
        ...quiz,
        questions: finalQuestions
    });
});

// POST /:id/submit - Submit answers and get score
app.post('/:id/submit', async (c) => {
    const db = createDb(c.env.DB);
    const quizId = c.req.param('id');
    const auth = c.get('auth');
    const tenant = c.get('tenant');
    if (!auth || !auth.userId) return c.json({ error: 'Authentication required' }, 401);
    if (!tenant) return c.json({ error: 'Tenant context missing' }, 400);

    const { answers } = await c.req.json(); // { questionId: answerValue }

    const quiz = await db.select().from(quizzes).where(and(eq(quizzes.id, quizId), eq(quizzes.tenantId, tenant.id))).get();
    if (!quiz) return c.json({ error: 'Quiz not found' }, 404);

    const questions = await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, quizId)).all();

    let totalPoints = 0;
    let earnedPoints = 0;
    const results: any[] = [];

    for (const q of questions) {
        totalPoints += q.points || 1;
        const userAnswer = answers[q.id];
        const isCorrect = userAnswer === q.correctAnswer;

        if (isCorrect) {
            earnedPoints += q.points || 1;
        }

        results.push({
            questionId: q.id,
            isCorrect,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation
        });
    }

    const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    const passed = score >= (quiz.passingScore || 0);

    const submissionId = `qs_${(globalThis as any).crypto.randomUUID()}`;
    await db.insert(quizSubmissions).values({
        id: submissionId,
        quizId,
        userId: auth.userId,
        tenantId: tenant.id,
        score,
        passed,
        answers // Store full submission
    }).run();

    return c.json({
        submissionId,
        score,
        passed,
        results
    });
});

export default app;
