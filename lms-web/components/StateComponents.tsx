export function LoadingSpinner({ message = "A carregar..." }: { message?: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-12">
            <div className="w-8 h-8 border-3 border-sage border-t-transparent rounded-full animate-spin" />
            <p className="mt-3 text-charcoal/60 text-sm">{message}</p>
        </div>
    );
}

export function EmptyState({
    title,
    message
}: {
    title: string;
    message: string;
}) {
    return (
        <div className="text-center py-12">
            <h3 className="text-lg font-medium text-charcoal">{title}</h3>
            <p className="mt-2 text-charcoal/60">{message}</p>
        </div>
    );
}

export function ErrorState({
    message,
    onRetry
}: {
    message: string;
    onRetry?: () => void;
}) {
    return (
        <div className="text-center py-12">
            <div className="text-red-500 mb-2">⚠️</div>
            <p className="text-charcoal/80">{message}</p>
            {onRetry && (
                <button
                    onClick={onRetry}
                    className="mt-4 px-4 py-2 bg-sage text-white rounded-lg hover:bg-sage/90"
                >
                    Tentar Novamente
                </button>
            )}
        </div>
    );
}
