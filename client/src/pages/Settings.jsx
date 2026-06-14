import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { BrandLogo } from '../components/BrandLogo';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? 'http://localhost:8000' : 'https://agrix-1coj.onrender.com');

export default function Settings() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  
  const initialLang = i18n.language || 'en';
  
  const [language, setLanguage] = useState(initialLang);
  const [landUnit, setLandUnit] = useState('Acres');
  const [primaryCrop, setPrimaryCrop] = useState('Wheat');
  const [farmDescription, setFarmDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const fetchUser = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/user/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.farm_description) {
          setFarmDescription(data.farm_description);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    // Sync state with i18n just in case it was changed elsewhere
    setLanguage(i18n.language || 'en');
  }, [i18n.language]);

  const handleLanguageChange = (e) => {
    const lang = e.target.value;
    setLanguage(lang);
    // In a real app, you would also push this change to the backend /api/user/settings here
  };

  const handleUpdateFarmDescription = async () => {
    setIsSaving(true);
    const token = localStorage.getItem('token');
    
    try {
      if (farmDescription.trim()) {
        const response = await fetch(`${API_BASE_URL}/api/user/farm-description/text`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ description: farmDescription, language: i18n.language })
        });
        
        if (response.ok) {
          await fetchUser();
          showToast(t('settings.toast_pref_success', 'Farm description updated successfully!'), 'success');
        } else {
          const errorData = await response.json().catch(() => null);
          showToast(`Error: ${errorData?.detail || 'Failed to update'}`, 'error');
        }
      }
    } catch (e) {
      console.error(e);
      showToast(t('settings.toast_pref_error', 'Error saving preferences.'), 'error');
    }
    setIsSaving(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      i18n.changeLanguage(language);
      setIsSaving(false);
      showToast(t('settings.toast_pref_success', 'Preferences saved successfully!'), 'success');
    } catch (e) {
      console.error(e);
      setIsSaving(false);
      showToast(t('settings.toast_pref_error', 'Error saving preferences.'), 'error');
    }
  };

  return (
    <div className="dashboard-shell settings-shell min-h-screen bg-background">
      <nav className="border-b-4 border-black bg-white px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <BrandLogo
          className="cursor-pointer"
          tagline="Smart Farming"
          markClassName="w-11 h-11"
          onClick={() => navigate('/dashboard')}
        />
        <div className="flex items-center gap-4">
           <Button variant="outline" className="py-2 px-4 text-sm" onClick={() => navigate('/dashboard')}>{t('settings.back', 'Back')}</Button>
        </div>
      </nav>

      {/* Bauhaus Toast */}
      {toast.show && (
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ease-in-out">
          <div className={`px-6 py-4 border-4 border-black font-bold uppercase tracking-widest text-lg shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ${toast.type === 'error' ? 'bg-primary-red text-white' : 'bg-green-400 text-black'}`}>
            {toast.message}
          </div>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-4xl md:text-5xl lg:text-7xl font-black uppercase tracking-tighter mb-8 leading-none">
          {t('settings.title', 'FARMER SETTINGS')}
        </h1>

        <Card className="bg-white border-4 border-black shadow-bauhaus space-y-8 p-8">
          
          <div className="flex flex-col gap-2">
            <label className="font-bold uppercase tracking-widest text-lg">{t('settings.language', 'Language')}</label>
            <select 
              value={language} 
              onChange={handleLanguageChange}
              className="w-full border-4 border-black p-4 bg-white text-xl font-bold uppercase focus:outline-none focus:ring-4 focus:ring-primary-blue transition-all"
            >
              <option value="en">English</option>
              <option value="hi">हिंदी (Hindi)</option>
              <option value="mr">मराठी (Marathi)</option>
              <option value="pa">ਪੰਜਾਬੀ (Punjabi)</option>
              <option value="te">తెలుగు (Telugu)</option>
              <option value="ta">தமிழ் (Tamil)</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-bold uppercase tracking-widest text-lg">{t('settings.land_size', 'Land Size Unit')}</label>
            <select 
              value={landUnit} 
              onChange={(e) => setLandUnit(e.target.value)}
              className="w-full border-4 border-black p-4 bg-white text-xl font-bold uppercase focus:outline-none focus:ring-4 focus:ring-primary-blue transition-all"
            >
              <option value="Acres">{t('settings.acres', 'Acres')}</option>
              <option value="Hectares">{t('settings.hectares', 'Hectares')}</option>
              <option value="Bigha">{t('settings.bigha', 'Bigha')}</option>
              <option value="Guntha">{t('settings.guntha', 'Guntha')}</option>
              <option value="Biswa">{t('settings.biswa', 'Biswa')}</option>
              <option value="Kanal">{t('settings.kanal', 'Kanal')}</option>
              <option value="Marla">{t('settings.marla', 'Marla')}</option>
              <option value="Cent">{t('settings.cent', 'Cent')}</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-bold uppercase tracking-widest text-lg">{t('settings.primary_crop', 'Primary Crop')}</label>
            <select 
              value={primaryCrop} 
              onChange={(e) => setPrimaryCrop(e.target.value)}
              className="w-full border-4 border-black p-4 bg-white text-xl font-bold uppercase focus:outline-none focus:ring-4 focus:ring-primary-blue transition-all"
            >
              <option value="Wheat">{t('settings.wheat', 'Wheat')}</option>
              <option value="Rice">{t('settings.rice', 'Rice')}</option>
              <option value="Sugarcane">{t('settings.sugarcane', 'Sugarcane')}</option>
              <option value="Cotton">{t('settings.cotton', 'Cotton')}</option>
              <option value="Maize">{t('settings.maize', 'Maize')}</option>
              <option value="Pearl Millet">{t('settings.pearl_millet', 'Pearl Millet / Bajra')}</option>
              <option value="Sorghum">{t('settings.sorghum', 'Sorghum / Jowar')}</option>
              <option value="Mustard">{t('settings.mustard', 'Mustard')}</option>
              <option value="Groundnut">{t('settings.groundnut', 'Groundnut / Peanut')}</option>
              <option value="Chickpea">{t('settings.chickpea', 'Chickpea / Gram')}</option>
              <option value="Soybean">{t('settings.soybean', 'Soybean')}</option>
            </select>
          </div>

          <div className="flex flex-col gap-2 border-t-4 border-black pt-6">
              <div className="flex justify-between items-center mb-2">
                <label className="block font-bold uppercase tracking-widest text-sm">
                  {t('settings.farm_desc', 'Farm Description (AI Processed)')}
                </label>
              </div>
              <p className="text-sm text-gray-500 mb-4 font-medium">
                {t('settings.farm_desc_helper', 'Update your farm description to automatically detect crops and land size.')}
              </p>
              <textarea
                value={farmDescription}
                onChange={(e) => setFarmDescription(e.target.value)}
                rows={4}
                className="w-full bg-white border-4 border-black p-4 font-medium focus:outline-none focus:ring-4 focus:ring-primary-yellow focus:border-black transition-all resize-none mb-2"
                placeholder={t('settings.farm_desc_placeholder', 'E.g., I farm 5 acres of wheat and 2 acres of sugarcane in Punjab.')}
              />
              <div className="flex justify-end">
                <Button 
                  onClick={handleUpdateFarmDescription} 
                  disabled={isSaving || !farmDescription.trim()}
                  variant="primary"
                  className="bg-black text-white hover:bg-gray-800"
                >
                  {isSaving ? t('settings.saving', 'Saving...') : t('settings.update_farm_desc', 'Update Farm Description')}
                </Button>
              </div>
          </div>

          <Button 
            className="w-full py-4 text-xl" 
            onClick={handleSave} 
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : t('settings.save', 'Save Preferences')}
          </Button>

        </Card>
      </main>
    </div>
  );
}
