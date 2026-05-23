export default function RechargeWalletModal({ open, onClose, balanceRupees = 0 }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Recharge credits first</h2>
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          Your wallet balance is <strong>₹{balanceRupees}</strong>. Each email or phone reveal uses{' '}
          <strong>1 credit (₹1)</strong>.
        </p>
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          Ask your company admin to add credits to your account, or contact Connect Intel support to top up
          your wallet. You can search for free — reveals require credits.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-900 text-white hover:bg-gray-800"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}
