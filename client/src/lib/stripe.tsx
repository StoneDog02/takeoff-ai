/**
 * Stripe provider for the client. Loads Stripe with the publishable key and
 * wraps children in Elements so CardElement and confirmCardSetup work.
 * Used by the signup wizard (Step 6). If VITE_STRIPE_PUBLISHABLE_KEY is not
 * set, children still render but Stripe calls will fail until the key is added.
 */
import { loadStripe } from '@stripe/stripe-js'
import { Elements } from '@stripe/react-stripe-js'
import type { ReactNode } from 'react'

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined

export const stripePromise = publishableKey ? loadStripe(publishableKey) : null

export const isStripeConfigured = Boolean(publishableKey && publishableKey.startsWith('pk_'))

interface StripeElementsProviderProps {
  children: ReactNode
}

/**
 * Wraps children in Stripe Elements. Use around the SignupWizard (or any
 * component that uses CardElement / useStripe / useElements).
 */
export function StripeElementsProvider({ children }: StripeElementsProviderProps) {
  if (!stripePromise) {
    return <>{children}</>
  }
  return (
    <Elements
      stripe={stripePromise}
      options={{
        appearance: {
          theme: 'stripe',
          variables: {
            fontFamily: "'DM Sans', sans-serif",
            borderRadius: '8px',
          },
        },
      }}
    >
      {children}
    </Elements>
  )
}
