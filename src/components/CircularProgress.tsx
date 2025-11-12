import { cn } from "@/lib/utils";

interface CircularProgressProps {
    value: number; // 0-100
    size?: number;
    strokeWidth?: number;
    className?: string;
    showValue?: boolean;
    valueClassName?: string;
}

export default function CircularProgress({
    value,
    size = 120,
    strokeWidth = 8,
    className,
    showValue = true,
    valueClassName
}: CircularProgressProps) {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (value / 100) * circumference;

    // Cor baseada no percentual
    const getColor = () => {
        if (value >= 90) return "text-red-500";
        if (value >= 70) return "text-orange-500";
        if (value >= 50) return "text-yellow-500";
        return "text-green-500";
    };

    return (
        <div className={cn("relative inline-flex items-center justify-center", className)}>
            <svg width={size} height={size} className="transform -rotate-90">
                {/* Background circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    strokeWidth={strokeWidth}
                    className="fill-none stroke-muted"
                />
                {/* Progress circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className={cn("fill-none transition-all duration-300", getColor())}
                    style={{ stroke: "currentColor" }}
                />
            </svg>
            {showValue && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className={cn("text-2xl font-bold", valueClassName)}>
                        {value < 1 && value > 0 ? '<1%' : `${Math.round(value)}%`}
                    </span>
                </div>
            )}
        </div>
    );
}
