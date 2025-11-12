// backend/src/utils/webhook.ts
import axios from 'axios';

const N8N_WEBHOOK_URL = 'https://docker-n8n-webhook.q4xusi.easypanel.host/webhook/estoque/entrada';

// Função para enviar os dados da venda para o n8n
export async function enviarVendaWebhook(payload: any) {
    try {
        const response = await axios.post(N8N_WEBHOOK_URL, payload);
        console.log('[Webhook] Venda enviada com sucesso:', response.status);
        return true;
    } catch (error: any) {
        console.error('[Webhook] Erro ao enviar venda:', error?.response?.data || error.message);
        return false;
    }
}