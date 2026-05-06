import { Header } from '@/components/layout/Header'
import { CommunicationModule } from '@/components/sms/CommunicationModule'

export default function CommunicationPage() {
  return (
    <div>
      <Header
        title="Communication & Bulk Messaging"
        description="Send bulk SMS and email campaigns to your leads at each sales stage"
      />
      <CommunicationModule />
    </div>
  )
}
