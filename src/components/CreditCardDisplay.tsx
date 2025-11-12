import { CreditCard, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreditCardDisplayProps {
    apelido: string;
    bandeira: string;
    ultimos_digitos: string;
    className?: string;
    size?: "sm" | "md" | "lg";
}

const bandeiraColors: Record<string, string> = {
    visa: "from-blue-600 to-blue-800",
    mastercard: "from-orange-500 to-red-600",
    elo: "from-yellow-500 to-yellow-700",
    "american express": "from-green-600 to-green-800",
    hipercard: "from-red-500 to-red-700",
    default: "from-slate-600 to-slate-800"
};

const sizeClasses = {
    sm: "w-64 h-40 text-xs",
    md: "w-80 h-48 text-sm",
    lg: "w-96 h-56 text-base"
};

export default function CreditCardDisplay({
    apelido,
    bandeira,
    ultimos_digitos,
    className,
    size = "md"
}: CreditCardDisplayProps) {
    const gradientClass = bandeiraColors[bandeira.toLowerCase()] || bandeiraColors.default;

    return (
        <div
            className={cn(
                "relative rounded-2xl p-6 text-white shadow-2xl",
                "bg-gradient-to-br",
                gradientClass,
                sizeClasses[size],
                "transform transition-all hover:scale-105",
                "flex flex-col justify-between",
                className
            )}
        >
            {/* Chip */}
            <div className="flex items-start justify-between">
                <div className="w-12 h-10 bg-yellow-400/30 rounded-md border-2 border-yellow-300/50" />
                <Wifi className="h-6 w-6 opacity-70" />
            </div>

            {/* Número do cartão */}
            <div className="space-y-2">
                <div className="flex items-center gap-3 text-xl font-mono tracking-wider">
                    <span>••••</span>
                    <span>••••</span>
                    <span>••••</span>
                    <span className="font-bold">{ultimos_digitos}</span>
                </div>
            </div>

            {/* Nome e bandeira */}
            <div className="flex items-end justify-between">
                <div>
                    <div className="text-xs opacity-70 uppercase">Nome do Cartão</div>
                    <div className="font-semibold text-lg">{apelido}</div>
                </div>
                <div className="text-right">
                    <div className="text-sm font-bold uppercase opacity-90">{bandeira}</div>
                </div>
            </div>

            {/* Efeito de brilho */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 hover:opacity-100 transition-opacity rounded-2xl pointer-events-none" />
        </div>
    );
}
