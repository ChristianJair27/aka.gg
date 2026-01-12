import { Button } from '@/components/Button';
import { Crown, Globe, Bot } from 'lucide-react';
import Contact from "@/components/Contact";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from "zod";
import { Input } from '@/components/Input';
import { axiosInstance } from '@/lib/axios';
import { motion } from 'framer-motion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ParticlesBackground from '@/components/ParticlesBackground';
import TrueFocus from '@/components/TrueFocus';
import RotatingText from '@/components/RotatingText';

const splitRiotId = (riotId: string) => {
  const [gameName = '', tagLine = ''] = riotId.trim().split('#');
  return { gameName, tagLine };
};

const statsSearchSchema = z.object({
  riotId: z.string().min(3, 'Riot ID debe tener al menos 3 caracteres').regex(/.+#.+/, 'Formato: Nombre#Tag'),
  region: z.string().min(1, 'Selecciona una región'),
});

type StatsSearchFormData = z.infer<typeof statsSearchSchema>;

const regions = [
  { value: 'na1', label: 'North America', icon: '🇺🇸' },
  { value: 'euw1', label: 'Europe West', icon: '🇪🇺' },
  { value: 'eun1', label: 'Europe Nordic & East', icon: '🇪🇺' },
  { value: 'kr', label: 'Korea', icon: '🇰🇷' },
  { value: 'br1', label: 'Brazil', icon: '🇧🇷' },
  { value: 'la1', label: 'Latin America North', icon: '🇲🇽' },
  { value: 'la2', label: 'Latin America South', icon: '🇦🇷' },
  { value: 'oc1', label: 'Oceania', icon: '🇦🇺' },
  { value: 'ru', label: 'Russia', icon: '🇷🇺' },
  { value: 'tr1', label: 'Turkey', icon: '🇹🇷' },
  { value: 'jp1', label: 'Japan', icon: '🇯🇵' },
];

const aiTips = [
  'Wardea el río temprano para evitar ganks.',
  'Farm intensivo = scaling late game.',
  'Coordina dragones con tu jungla.',
  'Analiza matchups y counterpickea.',
  'Pings claros > chat tóxico.',
  'Rotar después de push es clave.',
  'Vision denegada = ventaja de mapa.',
];

const Home = () => {
  const navigate = useNavigate();
  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentTip, setCurrentTip] = useState(aiTips[0]);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const { register, handleSubmit, formState: { errors }, setValue } = useForm<StatsSearchFormData>({
    resolver: zodResolver(statsSearchSchema),
    defaultValues: { region: 'na1' },
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTip(aiTips[Math.floor(Math.random() * aiTips.length)]);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (sectionRef.current) {
      const rect = sectionRef.current.getBoundingClientRect();
      setMousePosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const onSubmit = async (form: StatsSearchFormData) => {
    setIsSearching(true);
    setErrorMsg(null);
    try {
      const { gameName, tagLine } = splitRiotId(form.riotId);
      const { data } = await axiosInstance.get('/api/stats/resolve', {
        params: { region: form.region, gameName, tagLine },
      });
      const encodedRiotId = encodeURIComponent(`${data.gameName}#${data.tagLine}`);
      navigate(`/stats/${form.region}/${encodedRiotId}`, { state: { puuid: data.puuid } });
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Invocador no encontrado.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen text-white overflow-hidden relative">
      <ParticlesBackground
        particleCount={450}
        particleColors={['#ef4444', '#dc2626', '#b91c1c', '#7f1d1d']}
        speed={0.08}
        particleBaseSize={140}
        moveParticlesOnHover={true}
        alphaParticles={true}
      />
      <div className="fixed inset-0 -z-10 pointer-events-none bg-gradient-radial from-red-950/20 via-black/90 to-black" />

      <div className="relative z-20">
        {/* Header con logo y slogan */}
        <header className="py-20 md:py-32 px-6 text-center">
          <TrueFocus />
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-2xl md:text-3xl text-gray-300 mt-8"
          >
            Domina el Rift con stats reales y herramientas elite
          </motion.p>
        </header>

        {/* Sección principal continua - sin marcos ni cards */}
        <div
          ref={sectionRef}
          onMouseMove={handleMouseMove}
          className="relative px-6"
        >
          {/* Spotlight sutil */}
          <div
            className="absolute inset-0 pointer-events-none opacity-60"
            style={{
              background: `radial-gradient(1000px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(239, 68, 68, 0.15), transparent 60%)`,
            }}
          />

          <div className="max-w-5xl mx-auto">
            {/* RotatingText grande */}
            <div className="text-center mb-16">
              <h2 className="text-5xl md:text-7xl font-bold leading-tight min-h-40 flex items-center justify-center">
                <RotatingText
                  texts={[
                    'Domina tus Stats',
                    'Sube de Elo Real',
                    'Analiza como Pro',
                    'Mejora Cada Partida',
                    'Descubre tu Potencial',
                    'Controla el Rift'
                  ]}
                  rotationInterval={3200}
                  staggerFrom="center"
                  staggerDuration={0.03}
                  transition={{ type: 'spring', damping: 30, stiffness: 400 }}
                  initial={{ y: '100%', opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: '-120%', opacity: 0 }}
                  mainClassName="inline-block text-red-500 drop-shadow-2xl [text-shadow:0_0_40px_rgba(239,68,68,0.8)]"
                  splitLevelClassName="overflow-visible"
                  elementLevelClassName="inline-block"
                  splitBy="words"
                  auto={true}
                  loop={true}
                />
              </h2>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-xl md:text-2xl text-gray-400 mt-10"
              >
                Stats precisos • Análisis profundo • Herramientas elite
              </motion.p>
            </div>

            {/* Formulario integrado */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 max-w-2xl mx-auto mb-32">
              <div>
                <label className="flex items-center gap-3 text-gray-200 mb-3 text-lg">
                  <Crown className="text-red-400 h-6 w-6" /> Riot ID
                </label>
                <Input
                  {...register('riotId')}
                  placeholder="Faker#KR1"
                  className="h-16 text-xl bg-black/30 border border-red-800/40 focus:border-red-500 rounded-xl backdrop-blur-sm"
                />
                {errors.riotId && <p className="text-red-400 text-sm mt-2">{errors.riotId.message}</p>}
              </div>

              <div>
                <label className="flex items-center gap-3 text-gray-200 mb-3 text-lg">
                  <Globe className="text-red-400 h-6 w-6" /> Región
                </label>
                <Select onValueChange={(value) => setValue('region', value)} defaultValue="na1">
                  <SelectTrigger className="h-16 text-xl bg-black/30 border border-red-800/40 rounded-xl backdrop-blur-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.icon} {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {errorMsg && <p className="text-red-400 text-center">{errorMsg}</p>}

              <Button
                type="submit"
                disabled={isSearching}
                className="w-full h-20 text-2xl font-bold bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 shadow-2xl shadow-red-600/50 rounded-xl transform hover:scale-105 transition duration-300"
              >
                {isSearching ? 'Analizando...' : 'ANALIZAR AHORA'}
              </Button>
            </form>

            {/* Consejo IA integrado en el flujo */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              className="text-center max-w-4xl mx-auto"
            >
              <Bot className="h-20 w-20 text-red-400 mx-auto mb-8" />
              <p className="text-3xl md:text-4xl text-gray-100 italic leading-relaxed">
                "{currentTip}"
              </p>
              <p className="text-gray-400 mt-6 text-lg">— Consejo ATAK IA</p>
            </motion.div>
          </div>
        </div>

        <Contact />
      </div>
    </div>
  );
};

export default Home;