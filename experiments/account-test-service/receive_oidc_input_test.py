import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

path = Path(__file__).with_name('receive-oidc-input.py')
spec = importlib.util.spec_from_file_location('receiver', path)
receiver = importlib.util.module_from_spec(spec)
spec.loader.exec_module(receiver)

def base():
    origin = 'https://auth.signallayerit.com'
    return {'metadata': {'issuer': receiver.ISSUER, 'authorization_endpoint': origin+'/authorize', 'token_endpoint': origin+'/token', 'jwks_uri': origin+'/jwks'}, 'clientId': 'fake-client', 'subjects': ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']}

class ReceiverTests(unittest.TestCase):
    def test_private_write_no_overwrite_and_read(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)/'input.json'
            value = receiver.assemble(base(), 'fake-secret-not-real')
            receiver.write_private_json(output, value)
            self.assertEqual(output.stat().st_mode & 0o777, 0o600)
            self.assertEqual(receiver.read_private_json(output), value)
            with self.assertRaises(FileExistsError): receiver.write_private_json(output, value)
    def test_uid_wrong_issuer_and_newline_secret_rejected(self):
        for change in ({'subjects':['hashed-uid','numeric-id']}, {'metadata':{**base()['metadata'],'issuer':'https://other.invalid/'}}):
            with self.assertRaises(ValueError): receiver.assemble({**base(),**change}, 'fake-secret')
        with self.assertRaises(ValueError): receiver.assemble(base(), 'fake\nsecret')
    def test_non_tty_fails_without_echoing_supplied_input(self):
        result = subprocess.run([sys.executable,str(path),'unused','unused'],input='never-echo-this-secret',text=True,capture_output=True)
        self.assertEqual(result.returncode,1)
        self.assertNotIn('never-echo',result.stdout+result.stderr)
        self.assertEqual(result.stdout,'')
    def test_real_local_pty_secret_not_echoed(self):
        import pty, select, time
        with tempfile.TemporaryDirectory() as directory:
            source=Path(directory)/'base.json';source.write_text(json.dumps(base()));source.chmod(0o600)
            output=Path(directory)/'out.json';master,slave=pty.openpty()
            process=subprocess.Popen([sys.executable,str(path),str(source),str(output)],stdin=slave,stdout=slave,stderr=slave)
            os.close(slave);captured=b''
            try:
                deadline=time.monotonic()+3
                while b'(hidden): ' not in captured and time.monotonic()<deadline:
                    if select.select([master],[],[],0.1)[0]: captured+=os.read(master,4096)
                self.assertIn(b'(hidden): ',captured)
                os.write(master,b'fake-pty-secret-never-echo\n')
                process.wait(timeout=3)
                while select.select([master],[],[],0.1)[0]:
                    try: captured+=os.read(master,4096)
                    except OSError: break
                self.assertEqual(process.returncode,0)
                self.assertNotIn(b'fake-pty-secret-never-echo',captured)
                self.assertIn(b'Private OIDC input saved',captured)
                self.assertEqual(receiver.read_private_json(output)['clientSecret'],'fake-pty-secret-never-echo')
            finally:
                if process.poll() is None: process.kill();process.wait()
                os.close(master)
    def test_fifo_and_insecure_output_parent_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            fifo=Path(directory)/'fifo';os.mkfifo(fifo,0o600)
            with self.assertRaises(ValueError): receiver.read_private_json(fifo)
            parent=Path(directory)/'wide';parent.mkdir(mode=0o755)
            with self.assertRaises(ValueError): receiver.write_private_json(parent/'out',{})
            link=Path(directory)/'linked';link.symlink_to(parent,target_is_directory=True)
            with self.assertRaises(ValueError): receiver.write_private_json(link/'out',{})
    def test_symlink_and_world_readable_input_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            original=Path(directory)/'input';original.write_text(json.dumps(base()));original.chmod(0o644)
            with self.assertRaises(ValueError): receiver.read_private_json(original)
            link=Path(directory)/'link';link.symlink_to(original)
            with self.assertRaises(OSError): receiver.read_private_json(link)

if __name__ == '__main__': unittest.main()
