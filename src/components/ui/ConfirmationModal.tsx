import * as React from "react"
import { motion, AnimatePresence } from "motion/react"
import { Button } from "./button"
import { AlertTriangle, X } from "lucide-react"

export interface ConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'danger' | 'warning'
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Konfirmasi",
  cancelText = "Batal",
  variant = "default",
}: ConfirmationModalProps) {
  const [submitting, setSubmitting] = React.useState(false)

  const handleConfirm = async () => {
    try {
      setSubmitting(true)
      await onConfirm()
      onClose()
    } catch (error) {
      console.error(error)
    } finally {
      setSubmitting(false)
    }
  }

  // Prevent background scroll when modal is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }
    return () => {
      document.body.style.overflow = "unset"
    }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1E1E1E] p-6 shadow-2xl z-10"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              disabled={submitting}
            >
              <X className="w-5 h-5" />
            </button>

            {/* Content */}
            <div className="flex flex-col items-center text-center mt-2">
              {variant !== "default" && (
                <div
                  className={`p-3 rounded-full mb-4 ${
                    variant === "danger"
                      ? "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400"
                      : "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400"
                  }`}
                >
                  <AlertTriangle className="w-6 h-6" />
                </div>
              )}

              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-tight">
                {title}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                {description}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 sm:flex-none"
              >
                {cancelText}
              </Button>
              <Button
                variant={variant === "danger" ? "default" : "default"}
                size="sm"
                onClick={handleConfirm}
                disabled={submitting}
                className={`flex-1 sm:flex-none ${
                  variant === "danger"
                    ? "bg-red-600 hover:bg-red-700 text-white border-0 shadow-md focus:ring-red-500"
                    : variant === "warning"
                    ? "bg-amber-600 hover:bg-amber-700 text-white border-0 shadow-md focus:ring-amber-500"
                    : ""
                }`}
              >
                {submitting ? "Memproses..." : confirmText}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
