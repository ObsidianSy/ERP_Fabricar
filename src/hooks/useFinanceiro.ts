import { contasAPI } from "@/lib/financeiro";
import { toast } from "sonner";

/**
 * Hook simplificado para deletar conta (compatível com o original)
 */
export function usePostEvent(onSuccessCallback?: () => void, onErrorCallback?: (error: Error) => void) {
    const postEvent = async (eventType: string, data: any) => {
        try {
            if (eventType === "conta.delete") {
                await contasAPI.deletar(data.id);
                if (onSuccessCallback) onSuccessCallback();
            }
        } catch (error: any) {
            if (onErrorCallback) onErrorCallback(error);
            throw error;
        }
    };

    return { postEvent, posting: false };
}
