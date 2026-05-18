import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LogoSVG from '@/assets/images/logos/logo_sb.svg';
import { GlowBeams } from '@/components/ui/GlowBeams';
import { GlowButton } from '@/components/ui/GlowButton';
import { Colors } from '@/constants/theme';

const SW = Dimensions.get('window').width;
const HERO_H = 140;

const AUTH = Colors.dark;
const BG = AUTH.background;
const CYAN = AUTH.primary;
const WHITE = AUTH.textDisplay;
const SURFACE = AUTH.surfaceElevated;
const BORDER = AUTH.borderVisible;
const MUTED = AUTH.textMuted;

export default function ConfirmarEmail() {
  const insets = useSafeAreaInsets();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const displayEmail = Array.isArray(email) ? email[0] : email;

  return (
    <View style={[st.root, { paddingBottom: insets.bottom + 18 }]}>
      <View>
        <View style={[st.hero, { height: HERO_H, marginTop: insets.top }]}>
          <GlowBeams width={SW} height={HERO_H} />
          <LogoSVG width={70} height={80} style={st.logo} />
        </View>

        <View style={st.copyBlock}>
          <Text style={st.title}>REVISA TU EMAIL</Text>
          <Text style={st.subtitle}>
            Hemos enviado un enlace de confirmación a
          </Text>
        </View>

        <View style={st.emailCard}>
          <Ionicons name="mail-outline" size={22} color={CYAN} />
          <Text style={st.emailText}>{displayEmail ?? 'tu correo'}</Text>
        </View>
      </View>

      <View style={st.middle}>
        <View style={st.infoCard}>
          <View style={st.iconCircle}>
            <Ionicons name="checkmark-done-outline" size={26} color={CYAN} />
          </View>

          <View style={st.infoTextBlock}>
            <Text style={st.infoTitle}>Activa tu cuenta</Text>
            <Text style={st.infoText}>
              Abre el enlace del email para confirmar tu cuenta y luego vuelve para iniciar sesión.
            </Text>
          </View>
        </View>
      </View>

      <View style={st.footer}>
        <GlowButton borderRadius={12}>
          <TouchableOpacity
            style={st.btnPrimary}
            onPress={() => router.replace('/(auth)/iniciar-sesion')}
            activeOpacity={0.82}
          >
            <Text style={st.btnPrimaryTxt}>IR AL LOGIN</Text>
            <Ionicons name="arrow-forward" size={20} color={BG} />
          </TouchableOpacity>
        </GlowButton>

        <Text style={st.hint}>
          ¿No recibiste el email? Revisa tu carpeta de spam.
        </Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -12,
  },
  logo: {
    marginLeft: -5,
  },
  copyBlock: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 18,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    color: WHITE,
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    color: AUTH.textSecondary,
    textAlign: 'center',
  },
  emailCard: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
  },
  emailText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    color: CYAN,
    fontWeight: '700',
  },
  middle: {
    justifyContent: 'center',
  },
  infoCard: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: CYAN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTextBlock: {
    flex: 1,
    gap: 5,
  },
  infoTitle: {
    fontSize: 14,
    lineHeight: 18,
    color: WHITE,
    fontWeight: '800',
  },
  infoText: {
    fontSize: 12,
    lineHeight: 17,
    color: AUTH.textSecondary,
  },
  footer: {
    gap: 16,
  },
  btnPrimary: {
    height: 56,
    borderRadius: 12,
    backgroundColor: CYAN,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  btnPrimaryTxt: {
    fontSize: 15,
    fontWeight: '800',
    color: BG,
    letterSpacing: 2.6,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    color: MUTED,
    textAlign: 'center',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
});
