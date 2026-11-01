import { ZOOM_TIME, ZOOM_LINK, ZOOM_LINKS, FOLLOWUP_HOURS } from '../config/config.js';

// Naya step add karne ke liye STEPS me ek entry daalo: { id, title, instruction }.
// instruction me {{ZOOM_TIME}}, {{ZOOM_LINK}}, {{FOLLOWUP_HOURS}} placeholders chalte hain.
export const STEPS = [
    {
        id: '1-2',
        title: 'Welcome + Naam/City',
        instruction: "Customer ke pehle 'Hello' par 'The Alliance Syndicate Journey' me warmly swagat karo. Greeting ka natural jawab do; normal conversation me naam ya mobile number mat maango."
    },
    {
        id: '3-4',
        title: 'Naam/City + Leader context',
        instruction: "Customer ka naam aur city puchho aur save karo. Leader ka naam sirf tab puchho jab conversation ke liye relevant ho; is jawab ke bina aage badhne se mat roko."
    },
    {
        id: '5-6',
        title: 'Profession branch + Platform fayde',
        instruction: "Profession puchho: Job / Study / Nothing. Jawab ke hisaab se branch chuno (Job: side income bina job chhode; Study: padhai ke saath earning; Nothing: zero se start) aur uske mutabik platform ke fayde batao."
    },
    {
        id: '7',
        title: 'Zoom ke liye ready',
        instruction: "Puchho ki kya customer Zoom session ke liye ready hai. Ready hone par DYNAMIC ZOOM LINK SELECTION ke hisaab se sahi session ka time batao aur confirmation message bhejo. Link abhi mat do."
    },
    {
        id: '8-9',
        title: 'Meeting feedback + Agle din ka schedule',
        instruction: "Meeting ke baad feedback lo. Exactly 3 sawal puchho (ek-ek karke): kya samajh aaya, kya sabse pasand aaya, koi doubt. Fir agle din ke liye customer ki free timing puchkar schedule karo."
    },
    {
        id: '10-12',
        title: 'Zoom link + Binary tree + Income/Network',
        instruction: "DYNAMIC ZOOM LINK SELECTION ke hisaab se sahi Zoom link share karo. Binary tree link request par pehle naam aur mobile number confirm karo; uske baad system record match karke shared link bhejega. Income aur network kaise banta hai simple Hinglish me samjhao (income potential hai, guaranteed nahi)."
    },
    {
        id: '13+',
        title: 'Badhai + Payment day + Follow-up',
        instruction: "Customer ko badhai do aur agla relevant step batao. Account/payment status current CRM record ke mutabik batao. Agar {{FOLLOWUP_HOURS}} ghante tak reply na aaye to follow-up message trigger hota hai."
    }
];

function fill(text) {
    return text
        .replaceAll('{{ZOOM_TIME}}', ZOOM_TIME)
        .replaceAll('{{ZOOM_LINK}}', ZOOM_LINK)
        .replaceAll('{{FOLLOWUP_HOURS}}', String(FOLLOWUP_HOURS));
}

// Naya Zoom session type config.js ke ZOOM_LINKS me add karo; yahan sirf audience hint chahiye.
const ZOOM_AUDIENCE_HINTS = {
    planShow: 'customer naya hai / payment nahi di hai aur plan ya presentation attend karne ki baat ho rahi hai',
    training: 'customer ne token money / payment de diya hai aur training ya onboarding ki baat ho rahi hai',
    leadership: 'customer active team member / leader hai aur leadership meeting ki baat ho rahi hai'
};

export function buildZoomSelectionPrompt(links = ZOOM_LINKS) {
    const options = Object.entries(links).map(([key, z]) =>
        `- ${key}: use when ${ZOOM_AUDIENCE_HINTS[key] || z.description}. Link: ${z.link} | Time: ${z.time}`);
    return `
DYNAMIC ZOOM LINK SELECTION:
Zoom link ya time bhejne se pehle poori chat history aur current step padho, phir khud decide karo ki is customer ke liye in me se kaun sa session sahi hai:
${options.join('\n')}
Rules: CRM record me payment/token status available ho aur baat training/onboarding ki ho to training. Naye customer ko plan/presentation ke liye planShow. Sirf EK session ka link aur uska time bhejo, kabhi do links ek saath nahi. Agar context se saaf na ho to pehle ek chhota sawal puchho (jaise 'Kya aapne token money de diya hai?'), andaza mat lagao. Links aur time sirf upar likhe values se lo, naye mat banao.
`;
}

export function buildStateMachinePrompt(steps = STEPS) {
    const lines = steps.map((step, i) => `STEP ${step.id} - ${step.title}: ${fill(step.instruction)}`);
    return `
STRICT CONVERSATION STATE MACHINE:
- Naam aur mobile number sirf tab poochho/confirm karo jab current message binary-tree, tree-link, ya account/login details maange. Purani pending verification normal greeting ya unrelated message ko interrupt na kare.
- Normal greetings aur small talk ka natural, professional jawab do; naam/location collect karne ke liye conversation ko mat roko.
- Binary Tree, tree-link, ya login details ke request par pehle user se unka naam aur mobile number poochho/confirm karo; pehle response mein link mat bhejo.
- Dono details milne par server WhatsApp sender ke number ke against Supabase member name match karke configured shared portal link bhejta hai. Match hone par bhi password ya CRM Login ID share mat karo.
- Kabhi bhi password ya CRM login ID share mat karo; login help ke liye organization ka secure password-reset option batao.
- Conversation history se current step pehchano aur usi step par kaam karo.
- Customer ke sawal ka jawab pehle do, phir usi step ka agla sawal dobara naturally poochho.
- Ek reply me sirf ek step.
- Automated inactivity follow-ups are sent separately: payment-pending leads after 2 hours, and Zoom-link or other eligible unfinished leads after 24 hours.
${lines.join('\n')}
${buildZoomSelectionPrompt()}`;
}

export function buildFollowUpMessage(name) {
    return `Namaste ${name || 'ji'}! 😊 Aapne payment day ke liye apni taiyari kar li? Koi doubt ho to bataiye, main madad ke liye yahin hoon.`;
}

export const FOLLOWUP_DELAY_MS = FOLLOWUP_HOURS * 60 * 60 * 1000;
