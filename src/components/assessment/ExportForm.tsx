'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/UiButton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/UiCard";
import { exportAssessment, sendAssessmentEmail } from '@/lib/api';

interface ExportFormProps {
  assessmentId: string;
}

interface FormData {
  name: string;
  email: string;
  organisationName: string;
  organisationRegNumber: string;
  wantsContact: boolean;
}

const initialFormData: FormData = {
  name: '',
  email: '',
  organisationName: '',
  organisationRegNumber: '',
  wantsContact: false
};

export function ExportForm({ assessmentId }: ExportFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setError(null);
  };

  const handleDownloadPDF = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.name) {
      setError('Palun täitke kõik kohustuslikud väljad');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const blob = await exportAssessment(assessmentId, formData);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ai-valmiduse-hinnang.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      setError('Viga PDF-i allalaadimisel. Palun proovige uuesti.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendEmail = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.name) {
      setError('Palun täitke kõik kohustuslikud väljad');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await sendAssessmentEmail(assessmentId, formData);
      alert('Hindamise tulemused on saadetud teie e-posti aadressile.');
    } catch (error) {
      console.error('Error sending email:', error);
      setError('Viga e-kirja saatmisel. Palun proovige uuesti.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Salvesta tulemused</CardTitle>
        <CardDescription>
          Täitke vorm, et saada tulemused PDF-ina või e-postiga
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form>
          {error && <div role="alert" className="error">{error}</div>}

          <div>
            <label htmlFor="name">Nimi *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
            />
          </div>

          <div>
            <label htmlFor="email">E-post *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
            />
          </div>

          <div>
            <label htmlFor="organisationName">Organisatsiooni nimi</label>
            <input
              type="text"
              id="organisationName"
              name="organisationName"
              value={formData.organisationName}
              onChange={handleInputChange}
            />
          </div>

          <div>
            <label htmlFor="organisationRegNumber">Registrikood</label>
            <input
              type="text"
              id="organisationRegNumber"
              name="organisationRegNumber"
              value={formData.organisationRegNumber}
              onChange={handleInputChange}
            />
          </div>

          <div>
            <label>
              <input
                type="checkbox"
                name="wantsContact"
                checked={formData.wantsContact}
                onChange={handleInputChange}
              />
              Soovin, et minuga võetaks ühendust AI-lahenduste juurutamiseks
            </label>
          </div>

          <div>
            <Button
              onClick={handleDownloadPDF}
              disabled={isSubmitting || !formData.email || !formData.name}
            >
              {isSubmitting ? 'Laadin alla...' : 'Laadi alla PDF'}
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={isSubmitting || !formData.email || !formData.name}
            >
              {isSubmitting ? 'Saadan...' : 'Saada e-postiga'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
} 